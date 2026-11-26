import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WISP_CONFIG } from '@/lib/config';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { isSafeCode } from '@/lib/security';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey);
}

// Bounded in-memory receiver cache for atomic counting
const MAX_VIEW_CACHE_ENTRIES = 10_000;
const receiverViewCache = new Set<string>();

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rl = checkRateLimit(`receipt_${clientIp}`, { limit: 120, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { code, type, eventType, receiverToken } = (body || {}) as Record<string, unknown>;

    if (!isSafeCode(code) || !isSafeCode(receiverToken)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    if (type !== 'drop' && type !== 'text') {
      return NextResponse.json({ error: 'Invalid item type' }, { status: 400 });
    }

    if (eventType !== 'view' && eventType !== 'download') {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const now = new Date();
    const nowIso = now.toISOString();

    const table = type === 'drop' ? 'drops' : 'secure_texts';

    // 1. Fetch item
    const { data: item, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .eq('session_code', code)
      .maybeSingle();

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Item not found or already purged', isDestroyed: true }, { status: 404 });
    }

    // 2. Check if expired
    if (new Date(item.expires_at) < now || item.is_destroyed) {
      if (!item.is_destroyed) {
        await supabase
          .from(table)
          .update({ is_destroyed: true })
          .eq('session_code', code);

        if (type === 'drop' && item.storage_path) {
          await supabase.storage.from(WISP_CONFIG.STORAGE_BUCKET).remove([item.storage_path]);
        }
      }
      return NextResponse.json({ error: 'Item has expired', isDestroyed: true }, { status: 410 });
    }

    // 3. Unique receiver check for view (bounded cache to prevent memory exhaustion)
    const cacheKey = `${code}_${receiverToken}_${eventType}`;
    const isNewReceiverView = eventType === 'view' && !receiverViewCache.has(cacheKey);
    if (isNewReceiverView) {
      if (receiverViewCache.size >= MAX_VIEW_CACHE_ENTRIES) {
        const oldestKey = receiverViewCache.values().next().value;
        if (oldestKey !== undefined) receiverViewCache.delete(oldestKey);
      }
      receiverViewCache.add(cacheKey);
    }

    // 4. Update counts
    let updatedViewCount = item.view_count || 0;

    if (eventType === 'view') {
      if (isNewReceiverView) {
        updatedViewCount += 1;
      }
    }

    // 5. Evaluate burn-after-reading (ONLY single-use burn burns/destroys the record)
    // Multi-recipient limits cap new admissions without destroying the file for existing viewers!
    const shouldBurn = item.burn_after_reading === true;

    const updatePayload: Record<string, unknown> = {
      view_count: updatedViewCount,
    };

    if (shouldBurn) {
      updatePayload.is_destroyed = true;
    }

    const { error: updateError } = await supabase
      .from(table)
      .update(updatePayload)
      .eq('session_code', code);

    if (updateError) {
      console.warn('Failed to update receipt status:', updateError.message);
    }

    // 6. If burned, delete storage blob
    if (shouldBurn && type === 'drop' && item.storage_path) {
      await supabase.storage.from(WISP_CONFIG.STORAGE_BUCKET).remove([item.storage_path]);
    }

    // Optional event record logging
    try {
      await supabase.from('access_events').insert({
        item_id: code,
        item_type: type,
        event_type: eventType,
        receiver_token_hash: receiverToken.slice(0, 32),
        created_at: nowIso,
      });
    } catch {
      // Non-fatal if events table is optional
    }

    return NextResponse.json({
      success: true,
      isDestroyed: shouldBurn,
      viewCount: updatedViewCount,
    });
  } catch (error: unknown) {
    console.error('Receipt confirmation error:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
