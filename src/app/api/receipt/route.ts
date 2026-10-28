import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WISP_CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey);
}

// In-memory receiver cache for atomic counting when access_events table is initializing
const receiverViewCache = new Set<string>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, type, eventType, receiverToken } = body;

    if (!code || !type || !eventType || !receiverToken) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
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
      // Mark destroyed if not already
      if (!item.is_destroyed) {
        await supabase
          .from(table)
          .update({ is_destroyed: true, state: 'destroyed', destroy_reason: 'ttl' })
          .eq('session_code', code);
        
        if (type === 'drop' && item.storage_path) {
          await supabase.storage.from(WISP_CONFIG.STORAGE_BUCKET).remove([item.storage_path]);
        }
      }
      return NextResponse.json({ error: 'Item has expired', isDestroyed: true }, { status: 410 });
    }

    // 3. Unique receiver check for view
    const cacheKey = `${code}_${receiverToken}_${eventType}`;
    const isNewReceiverView = eventType === 'view' && !receiverViewCache.has(cacheKey);
    if (isNewReceiverView) {
      receiverViewCache.add(cacheKey);
    }

    // 4. Update counts
    let updatedViewCount = item.view_count || 0;
    let updatedDownloadCount = item.download_count || 0;

    if (eventType === 'view') {
      if (isNewReceiverView) {
        updatedViewCount += 1;
      }
    } else if (eventType === 'download') {
      updatedDownloadCount += 1;
    }

    // 5. Evaluate burn-after-reading or max views
    const shouldBurn = 
      item.burn_after_reading || 
      (item.max_views !== null && updatedViewCount >= item.max_views);

    const updatePayload: Record<string, unknown> = {
      view_count: updatedViewCount,
      download_count: updatedDownloadCount,
      last_accessed_at: nowIso,
    };

    if (shouldBurn) {
      updatePayload.is_destroyed = true;
      updatePayload.state = 'destroyed';
      updatePayload.destroy_reason = 'burn';
    }

    const { error: updateError } = await supabase
      .from(table)
      .update(updatePayload)
      .eq('session_code', code);

    if (updateError) {
      console.warn('Failed to update receipt status with full payload, trying standard fields:', updateError.message);
      const fallbackPayload: Record<string, unknown> = {
        view_count: updatedViewCount,
      };
      if (shouldBurn) {
        fallbackPayload.is_destroyed = true;
      }
      await supabase.from(table).update(fallbackPayload).eq('session_code', code);
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
      downloadCount: updatedDownloadCount,
    });
  } catch (error: unknown) {
    console.error('Receipt confirmation error:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
