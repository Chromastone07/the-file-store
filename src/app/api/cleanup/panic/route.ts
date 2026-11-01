import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WISP_CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dropCodes = [], textCodes = [], chatCodes = [] } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Process drops: Remove from storage and mark destroyed
    if (Array.isArray(dropCodes) && dropCodes.length > 0) {
      // Find storage paths to purge
      const { data: drops } = await supabase
        .from('drops')
        .select('storage_path, session_code, group_code')
        .or(`session_code.in.(${dropCodes.join(',')}),group_code.in.(${dropCodes.join(',')})`);

      if (drops && drops.length > 0) {
        const paths = drops.map(d => d.storage_path).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from(WISP_CONFIG.STORAGE_BUCKET).remove(paths);
        }
      }

      // Mark destroyed with destroy_reason
      await supabase
        .from('drops')
        .update({ is_destroyed: true })
        .or(`session_code.in.(${dropCodes.join(',')}),group_code.in.(${dropCodes.join(',')})`);
    }

    // 2. Process secure texts: Mark destroyed
    if (Array.isArray(textCodes) && textCodes.length > 0) {
      await supabase
        .from('secure_texts')
        .update({ is_destroyed: true })
        .in('session_code', textCodes);
    }

    // 3. Process clipboard sessions: Delete
    if (Array.isArray(chatCodes) && chatCodes.length > 0) {
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

