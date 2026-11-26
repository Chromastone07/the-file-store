import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WISP_CONFIG } from '@/lib/config';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { sanitizeCodeList } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rl = checkRateLimit(`panic_${clientIp}`, { limit: 15, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many panic requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
    }

    const { dropCodes: rawDrops, textCodes: rawTexts, chatCodes: rawChats } = body as Record<string, unknown>;
    const dropCodes = sanitizeCodeList(rawDrops, 50);
    const textCodes = sanitizeCodeList(rawTexts, 50);
    const chatCodes = sanitizeCodeList(rawChats, 50);

    if (dropCodes.length === 0 && textCodes.length === 0 && chatCodes.length === 0) {
      return NextResponse.json({ success: true, message: 'No valid session codes provided' });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Process drops using parameterized .in() filters (zero PostgREST .or() string interpolation)
    if (dropCodes.length > 0) {
      const [{ data: bySession }, { data: byGroup }] = await Promise.all([
        supabase.from('drops').select('storage_path').in('session_code', dropCodes),
        supabase.from('drops').select('storage_path').in('group_code', dropCodes),
      ]);

      const pathSet = new Set<string>();
      for (const row of [...(bySession || []), ...(byGroup || [])]) {
        if (row.storage_path) pathSet.add(row.storage_path);
      }

      if (pathSet.size > 0) {
        await supabase.storage.from(WISP_CONFIG.STORAGE_BUCKET).remove(Array.from(pathSet));
      }

      await Promise.all([
        supabase.from('drops').update({ is_destroyed: true }).in('session_code', dropCodes),
        supabase.from('drops').update({ is_destroyed: true }).in('group_code', dropCodes),
      ]);
    }

    // 2. Process secure texts: Mark destroyed
    if (textCodes.length > 0) {
      await supabase
        .from('secure_texts')
        .update({ is_destroyed: true })
        .in('session_code', textCodes);
    }

    // 3. Process clipboard sessions: Delete
    if (chatCodes.length > 0) {
      await supabase
        .from('clipboard_sessions')
        .delete()
        .in('session_code', chatCodes);
    }

    return NextResponse.json({ success: true, message: 'Remote panic wipe executed successfully' });
  } catch (err: unknown) {
    console.error('Remote panic error:', err);
    return NextResponse.json(
      { error: 'Panic wipe failed', message: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    );
  }
}
