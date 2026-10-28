import { createClient } from '@supabase/supabase-js';
import { WISP_CONFIG } from '@/lib/config';

export interface CleanupResult {
  dropsDeleted: number;
  textsDeleted: number;
  timestamp: string;
}

/**
 * Server-side administrative cleanup of expired and destroyed files, texts, and clipboard sessions.
 * Requires SUPABASE_SERVICE_ROLE_KEY to bypass RLS and purge blobs from storage.
 */
export async function executeCleanup(): Promise<CleanupResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service role configuration for administrative cleanup.');
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date().toISOString();

  // 1. Fetch drops that are expired OR marked as destroyed
  const { data: expiredDrops, error: fetchError } = await supabaseAdmin
    .from('drops')
    .select('session_code, storage_path')
    .or(`is_destroyed.eq.true,expires_at.lt.${now}`);

  if (fetchError) {
    throw fetchError;
  }

  let filesDeleted = 0;

  // 2. Delete storage blobs and purge database rows
  if (expiredDrops && expiredDrops.length > 0) {
    const storagePaths = expiredDrops.map(drop => drop.storage_path).filter(Boolean);

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(WISP_CONFIG.STORAGE_BUCKET)
        .remove(storagePaths);

      if (storageError) {
        console.error('Error deleting blobs from storage:', storageError);
      }
    }

    const sessionCodes = expiredDrops.map(drop => drop.session_code);
    await supabaseAdmin
      .from('drops')
      .delete()
      .in('session_code', sessionCodes);

    filesDeleted = expiredDrops.length;
  }

  // 3. Delete expired or destroyed secure texts
  const { data: expiredTexts } = await supabaseAdmin
    .from('secure_texts')
    .delete()
    .or(`is_destroyed.eq.true,expires_at.lt.${now}`)
    .select('id');

  // 4. Delete expired clipboard sessions
  await supabaseAdmin
    .from('clipboard_sessions')
    .delete()
    .lt('expires_at', now);

  return {
    dropsDeleted: filesDeleted,
    textsDeleted: expiredTexts?.length || 0,
    timestamp: now,
  };
}
