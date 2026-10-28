import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

// Periodic cleanup of stale participants (grace period: 15s) and expired rooms
function pruneRooms() {
  const now = Date.now();
  for (const [code, room] of chatRooms.entries()) {
    if (room.expiresAt < now) {
      chatRooms.delete(code);
      continue;
    }
    // Remove participants whose last heartbeat was > 15 seconds ago
    for (const [token, participant] of room.participants.entries()) {
      if (now - participant.lastHeartbeat > 15_000) {
        room.participants.delete(token);
      }
    }
  }
}

export async function POST(request: Request) {
  pruneRooms();
  try {
    const body = await request.json();
    const { action, roomCode, participantToken, maxUsers = 2, durationSeconds = 300, alias, color } = body;

    if (!roomCode || !action) {
      return NextResponse.json({ error: 'Missing roomCode or action' }, { status: 400 });
    }

    const code = roomCode.toUpperCase();
    let room = chatRooms.get(code);

    // ── CREATE / INITIALIZE ROOM ──
    if (action === 'create') {
      const expiresAt = Date.now() + (durationSeconds * 1000);
      room = {
        code,
        hostToken: participantToken,
        maxUsers: Math.min(Math.max(2, maxUsers), 10000),
        expiresAt,
        participants: new Map(),
      };
      
      const hostParticipant: Participant = {
        id: participantToken,
        alias: alias || 'Host',
        color: color || '#6366f1',
        isHost: true,
        joinedAt: Date.now(),
        lastHeartbeat: Date.now(),
      };
      room.participants.set(participantToken, hostParticipant);
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
      if (!room) {
        // Room not in active memory yet; create room entry if it exists or allow first join
        const expiresAt = Date.now() + (durationSeconds * 1000);
        room = {
          code,
          hostToken: participantToken,
          maxUsers: Math.min(Math.max(2, maxUsers), 10000),
          expiresAt,
          participants: new Map(),
        };
        chatRooms.set(code, room);
      }

      // Check if participant is reconnecting with existing token
      const existing = room.participants.get(participantToken);
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

      // Server-side strict capacity check
      if (room.participants.size >= room.maxUsers) {
        return NextResponse.json(
          { error: `Room is full (${room.participants.size}/${room.maxUsers} online)` },
          { status: 403 }
        );
      }

      const isHost = room.participants.size === 0;
      const newParticipant: Participant = {
        id: participantToken,
        alias: alias || `User ${room.participants.size + 1}`,
        color: color || '#10b981',
        isHost,
        joinedAt: Date.now(),
        lastHeartbeat: Date.now(),
      };
      room.participants.set(participantToken, newParticipant);

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
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      const participant = room.participants.get(participantToken);
      if (participant) {
        participant.lastHeartbeat = Date.now();
      }

      return NextResponse.json({
        success: true,
        onlineCount: room.participants.size,
        maxUsers: room.maxUsers,
        participants: Array.from(room.participants.values()).map(p => ({
          alias: p.alias,
          color: p.color,
          isHost: p.isHost,
        })),
        expiresAt: room.expiresAt,
      });
    }

    // ── DESTROY ROOM (HOST ONLY) ──
    if (action === 'destroy') {
      if (!room) {
        return NextResponse.json({ success: true });
      }

      const participant = room.participants.get(participantToken);
      if (!participant?.isHost && room.hostToken !== participantToken) {
        return NextResponse.json({ error: 'Only the room host can destroy this room.' }, { status: 403 });
      }

      chatRooms.delete(code);
      return NextResponse.json({ success: true, destroyed: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
