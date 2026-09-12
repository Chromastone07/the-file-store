import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PHANTOM_CONFIG } from '@/lib/config';

// Force dynamic execution since cron jobs are not static
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Optional: Add CRON_SECRET for basic security if using Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET && 
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use the service role key to bypass RLS for the cleanup operations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'Missing service role key' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Fetch drops that are expired OR marked as destroyed
    const { data: expiredDrops, error: fetchError } = await supabaseAdmin
      .from('drops')
      .select('session_code, storage_path')
      .or(`is_destroyed.eq.true,expires_at.lt.${new Date().toISOString()}`);

    if (fetchError) {
      console.error('Error fetching expired drops:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // 2. Delete the actual encrypted files from Storage
    if (expiredDrops && expiredDrops.length > 0) {
      const storagePaths = expiredDrops.map(drop => drop.storage_path);
      
      const { error: storageError } = await supabaseAdmin.storage
        .from(PHANTOM_CONFIG.STORAGE_BUCKET)
        .remove(storagePaths);

      if (storageError) {
        console.error('Error deleting from storage:', storageError);
        // Continue anyway to try marking them as destroyed
      }
      
      // 3. DELETE the rows from the database entirely
      const sessionCodes = expiredDrops.map(drop => drop.session_code);
      await supabaseAdmin
        .from('drops')
        .delete()
        .in('session_code', sessionCodes);
    }

    // 4. Delete expired or destroyed secure texts entirely
    await supabaseAdmin
      .from('secure_texts')
      .delete()
      .or(`is_destroyed.eq.true,expires_at.lt.${new Date().toISOString()}`);

    // 5. Clean up expired clipboard sessions entirely
    await supabaseAdmin
      .from('clipboard_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());

    return NextResponse.json({ 
      success: true, 
      filesDeleted: expiredDrops?.length || 0 
    });

  } catch (error: any) {
    console.error('Cron cleanup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
