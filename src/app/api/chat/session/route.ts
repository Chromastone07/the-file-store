import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { isSafeCode, sanitizeHexColor } from '@/lib/security';

export const dynamic = 'force-dynamic';

const MAX_ROOMS = 10_000;
const MAX_DURATION_SECONDS = 7 * 24 * 3600;
const MIN_DURATION_SECONDS = 60;

interface Participant {
  id: string; // participant token
  alias: string;
  color: string;
  isHost: boolean;
  joinedAt: number;
  lastHeartbeat: number;
}

interface ChatRoomState {
  code: string;
  hostToken: string;
  maxUsers: number;
  expiresAt: number;
  participants: Map<string, Participant>;
}

// Global server in-memory tracking of active rooms & participants
const chatRooms = new Map<string, ChatRoomState>();

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// Periodic cleanup of stale participants (heartbeat timeout: 20s) and expired rooms
function pruneRooms() {
  const now = Date.now();
  for (const [code, room] of chatRooms.entries()) {
    if (room.expiresAt < now) {
      chatRooms.delete(code);
      continue;
    }
    // Remove participants whose last heartbeat was > 20 seconds ago
    for (const [token, participant] of room.participants.entries()) {
      if (now - participant.lastHeartbeat > 20_000) {
        room.participants.delete(token);
      }
    }
  }
}

export async function POST(request: Request) {
  // 1. Rate limiting protection: 60 req/min per IP
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(`chat_session_${clientIp}`, { limit: 60, windowMs: 60_000 });
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    );
  }

  pruneRooms();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'INVALID_INPUT', message: 'Invalid JSON payload' }, { status: 400 });
    }

    const { action, roomCode, participantToken, maxUsers = 2, durationSeconds = 300, alias, color } =
      (body || {}) as Record<string, unknown>;

    if (!isSafeCode(roomCode) || !action) {
      return NextResponse.json({ error: 'INVALID_CODE', message: 'Invalid room code format' }, { status: 400 });
    }

    if (!isSafeCode(participantToken)) {
      return NextResponse.json({ error: 'INVALID_TOKEN', message: 'Invalid participant token' }, { status: 400 });
    }

    const code = roomCode.trim().toUpperCase();
    const token = participantToken.trim();
    const safeAlias = typeof alias === 'string'
      ? alias.replace(/[\x00-\x1F\x7F<>]/g, '').trim().slice(0, 30)
      : '';

    const supabase = getSupabaseAdmin();
    let room = chatRooms.get(code);

    // ── CREATE ROOM ──
    if (action === 'create') {
      if (!room && chatRooms.size >= MAX_ROOMS) {
        return NextResponse.json(
          { error: 'SERVER_BUSY', message: 'Active room capacity temporarily reached. Try again shortly.' },
          { status: 503 }
        );
      }

      const rawDur = Number(durationSeconds);
      const safeDuration = Number.isFinite(rawDur)
        ? Math.min(Math.max(MIN_DURATION_SECONDS, Math.floor(rawDur)), MAX_DURATION_SECONDS)
        : 300;
      const expiresAtMs = Date.now() + safeDuration * 1000;
      const expiresAtIso = new Date(expiresAtMs).toISOString();
      const safeMaxUsers = Math.min(Math.max(2, parseInt(String(maxUsers), 10) || 2), 10000);

      // Register session in Supabase DB as persistent source of truth
      if (supabase) {
        await supabase
          .from('clipboard_sessions')
          .upsert({
            session_code: code,
            max_users: safeMaxUsers,
            expires_at: expiresAtIso,
            is_active: true,
          }, { onConflict: 'session_code' });
      }

      room = {
        code,
        hostToken: token,
        maxUsers: safeMaxUsers,
        expiresAt: expiresAtMs,
        participants: new Map(),
      };

      const hostParticipant: Participant = {
        id: token,
        alias: safeAlias || 'Host',
        color: sanitizeHexColor(color, '#6366f1'),
        isHost: true,
        joinedAt: Date.now(),
        lastHeartbeat: Date.now(),
      };
      room.participants.set(token, hostParticipant);
      chatRooms.set(code, room);

      return NextResponse.json({
        success: true,
        isHost: true,
        alias: hostParticipant.alias,
        color: hostParticipant.color,
        onlineCount: 1,
        maxUsers: room.maxUsers,
        expiresAt: room.expiresAt,
      });
    }

    // ── JOIN ROOM ──
    if (action === 'join') {
      // 1. If room not in memory, verify against persistent Supabase database
      if (!room && supabase) {
        const { data: dbSession } = await supabase
          .from('clipboard_sessions')
          .select('session_code, max_users, expires_at, is_active')
          .eq('session_code', code)
          .single();

        if (dbSession && dbSession.is_active && new Date(dbSession.expires_at).getTime() > Date.now()) {
          room = {
            code,
            hostToken: '',
            maxUsers: dbSession.max_users || 2,
            expiresAt: new Date(dbSession.expires_at).getTime(),
            participants: new Map(),
          };
          chatRooms.set(code, room);
        }
      }

      // 2. If room STILL does not exist, REJECT! Never auto-create ghost rooms on join!
      if (!room) {
        return NextResponse.json(
          {
            error: 'ROOM_NOT_FOUND',
            message: 'Chat room not found. It may have expired or was never created.',
          },
          { status: 404 }
        );
      }

      // Check if room expired
      if (room.expiresAt <= Date.now()) {
        chatRooms.delete(code);
        return NextResponse.json(
          {
            error: 'ROOM_EXPIRED',
            message: 'This chat room has expired and is no longer accessible.',
          },
          { status: 410 }
        );
      }

      // 3. Check if participant is reconnecting with an already-admitted token
      const existing = room.participants.get(token);
      if (existing) {
        existing.lastHeartbeat = Date.now();
        return NextResponse.json({
          success: true,
          isHost: existing.isHost,
          alias: existing.alias,
          color: existing.color,
          onlineCount: room.participants.size,
          maxUsers: room.maxUsers,
          expiresAt: room.expiresAt,
          isReconnect: true,
        });
      }

      // 4. Server-side strict capacity check: REJECT if room is at max capacity!
      if (room.participants.size >= room.maxUsers) {
        return NextResponse.json(
          {
            error: 'ROOM_FULL',
            message: `This chat room is restricted to ${room.maxUsers} member${room.maxUsers > 1 ? 's' : ''} and is currently at capacity.`,
            maxUsers: room.maxUsers,
            onlineCount: room.participants.size,
          },
          { status: 403 }
        );
      }

      // 5. Admit new participant
      const isHost = room.participants.size === 0;
      const newParticipant: Participant = {
        id: token,
        alias: safeAlias || `User ${room.participants.size + 1}`,
        color: sanitizeHexColor(color, '#10b981'),
        isHost,
        joinedAt: Date.now(),
        lastHeartbeat: Date.now(),
      };
      room.participants.set(token, newParticipant);

      return NextResponse.json({
        success: true,
        isHost,
        alias: newParticipant.alias,
        color: newParticipant.color,
        onlineCount: room.participants.size,
        maxUsers: room.maxUsers,
        expiresAt: room.expiresAt,
        isReconnect: false,
      });
    }

    // ── HEARTBEAT / STATUS ──
    if (action === 'heartbeat') {
      if (!room) {
        return NextResponse.json({ error: 'ROOM_NOT_FOUND', message: 'Room not active' }, { status: 404 });
      }

      const participant = room.participants.get(token);
      if (participant) {
        participant.lastHeartbeat = Date.now();
      }

      return NextResponse.json({
        success: true,
        onlineCount: room.participants.size,
        maxUsers: room.maxUsers,
        participants: participant
          ? Array.from(room.participants.values()).map(p => ({
              alias: p.alias,
              color: p.color,
              isHost: p.isHost,
            }))
          : [],
        expiresAt: room.expiresAt,
      });
    }

    // ── LEAVE ROOM ──
    if (action === 'leave') {
      if (room) {
        room.participants.delete(token);
      }
      return NextResponse.json({ success: true, left: true });
    }

    // ── DESTROY ROOM ──
    if (action === 'destroy') {
      if (room) {
        const participant = room.participants.get(token);
        if (!participant?.isHost && room.hostToken !== token) {
          return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Only the room host can destroy this room.' }, { status: 403 });
        }
        chatRooms.delete(code);
      }

      if (supabase) {
        await supabase
          .from('clipboard_sessions')
          .delete()
          .eq('session_code', code);
      }

      return NextResponse.json({ success: true, destroyed: true });
    }

    return NextResponse.json({ error: 'UNKNOWN_ACTION', message: 'Action not supported' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'SERVER_ERROR', message }, { status: 500 });
  }
}
