// PHANTOM — Supabase Client & Database Helpers

import { createClient } from '@supabase/supabase-js';
import { PHANTOM_CONFIG } from './config';

// ─── Client ──────────────────────────────────────────────────

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ───────────────────────────────────────────────────

export interface DropRecord {
  id: string;
  session_code: string;
  group_code: string | null;
  storage_path: string;
  encrypted_filename: string | null;
  file_type: string | null;
  file_size: number;
  encryption_iv: string;
  encryption_salt: string | null;
  has_password: boolean;
  burn_after_reading: boolean;
  max_views: number | null;
  view_count: number;
  expires_at: string;
  is_destroyed: boolean;
  created_at: string;
}

export interface SecureTextRecord {
  id: string;
  session_code: string;
  encrypted_content: string;
  content_type: string;
  encryption_iv: string;
  encryption_salt: string | null;
  has_password: boolean;
  burn_after_reading: boolean;
  max_views: number | null;
  view_count: number;
  expires_at: string;
  is_destroyed: boolean;
  created_at: string;
}

export interface ClipboardSessionRecord {
  session_code: string;
  max_users: number;
  expires_at: string;
}

// ─── Drop Operations ─────────────────────────────────────────

/** Upload an encrypted file blob to Supabase Storage */
export async function uploadEncryptedFile(
  storagePath: string,
  encryptedData: ArrayBuffer
): Promise<{ error: Error | null }> {
  const { error } = await supabase.storage
    .from(PHANTOM_CONFIG.STORAGE_BUCKET)
    .upload(storagePath, encryptedData, {
      contentType: 'application/octet-stream', // always octet-stream for encrypted blobs
      upsert: false,
    });
  return { error: error ? new Error(error.message) : null };
}

/** Create a drop record in the database */
export async function createDropRecord(drop: {
  session_code: string;
  group_code?: string | null;
  storage_path: string;
  encrypted_filename: string | null;
  file_type: string | null;
  file_size: number;
  encryption_iv: string;
  encryption_salt: string | null;
  has_password: boolean;
  burn_after_reading: boolean;
  max_views: number | null;
  expires_at: string;
}): Promise<{ data: DropRecord | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('drops')
    .insert([drop])
    .select()
    .single();
  return { data, error: error ? new Error(error.message) : null };
}

/** Fetch a drop by session code */
export async function getDropByCode(code: string): Promise<{ data: DropRecord | null; error: Error | null }> {
  const { data, error } = await supabase
    .rpc('get_drop_by_code', { p_code: code })
    .single();
  return { data: data as DropRecord | null, error: error ? new Error(error.message) : null };
}

/** Fetch all drops belonging to a group or matching a session code */
export async function getDropsByLookupCode(lookupCode: string): Promise<{ data: DropRecord[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .rpc('get_drops_by_lookup_code', { p_code: lookupCode });
  return { data: data as DropRecord[] | null, error: error ? new Error(error.message) : null };
}

/** Get a signed URL for downloading an encrypted file */
export async function getSignedDownloadUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PHANTOM_CONFIG.STORAGE_BUCKET)
    .createSignedUrl(storagePath, PHANTOM_CONFIG.SIGNED_URL_EXPIRY);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Increment view count and optionally mark as destroyed (burn after reading) */
export async function recordView(sessionCode: string, burnAfterReading: boolean): Promise<void> {
  const { data: drop } = await getDropByCode(sessionCode);
  if (!drop) return;

  const newCount = (drop.view_count || 0) + 1;
  const shouldDestroy = burnAfterReading || (drop.max_views && newCount >= drop.max_views);

  await supabase.rpc('record_drop_view', { p_code: sessionCode, p_burn: burnAfterReading });

  // If destroyed, also delete the storage blob
  if (shouldDestroy) {
    await supabase.storage
      .from(PHANTOM_CONFIG.STORAGE_BUCKET)
      .remove([drop.storage_path]);
  }
}
// --- Clipboard Sessions (Database limit enforcement) ---

export async function createClipboardSession(record: ClipboardSessionRecord) {
  return await supabase
    .from('clipboard_sessions')
    .insert(record);
}

export async function getClipboardSession(sessionCode: string) {
  const { data, error } = await supabase
    .rpc('get_clipboard_session', { p_code: sessionCode })
    .single();
    
  return { data: data as ClipboardSessionRecord | null, error };
}

export async function deleteClipboardSession(sessionCode: string) {
  return await supabase
    .rpc('delete_clipboard_session', { p_code: sessionCode });
}
/** Delete a drop completely — handles single-file and multi-file groups */
export async function destroyDrop(sessionCode: string): Promise<void> {
  // Try single file first
  const { data } = await getDropByCode(sessionCode);
  if (data) {
    await supabase.storage
      .from(PHANTOM_CONFIG.STORAGE_BUCKET)
      .remove([data.storage_path]);
  }
  
  // Also destroy any multi-file group members
  const { data: groupDrops } = await getDropsByLookupCode(sessionCode);
  
  if (groupDrops && groupDrops.length > 0) {
    const paths = groupDrops.map(d => d.storage_path);
    await supabase.storage
      .from(PHANTOM_CONFIG.STORAGE_BUCKET)
      .remove(paths);
  }

  await supabase.rpc('destroy_drop_by_code', { p_code: sessionCode });
}

// ─── Secure Text Operations ─────────────────────────────────

/** Create a secure text record */
export async function createSecureText(text: {
  session_code: string;
  encrypted_content: string;
  content_type: string;
  encryption_iv: string;
  encryption_salt: string | null;
  has_password: boolean;
  burn_after_reading: boolean;
  max_views: number | null;
  expires_at: string;
}): Promise<{ data: SecureTextRecord | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('secure_texts')
    .insert([text])
    .select()
    .single();
  return { data, error: error ? new Error(error.message) : null };
}

/** Fetch a secure text by session code */
export async function getSecureTextByCode(code: string): Promise<{ data: SecureTextRecord | null; error: Error | null }> {
  const { data, error } = await supabase
    .rpc('get_secure_text_by_code', { p_code: code })
    .single();
  return { data: data as SecureTextRecord | null, error: error ? new Error(error.message) : null };
}

/** Record a text view and optionally destroy */
export async function recordTextView(sessionCode: string, burnAfterReading: boolean): Promise<void> {
  await supabase.rpc('record_text_view', { p_code: sessionCode, p_burn: burnAfterReading });
}

/** Delete a secure text completely */
export async function destroySecureText(sessionCode: string): Promise<void> {
  await supabase.rpc('destroy_text_by_code', { p_code: sessionCode });
}

// ─── Targeted Expiry Cleanup ─────────────────────────────────

/** Destroy a specific expired drop (called from receiver when expiry detected) */
export async function destroyExpiredDrop(sessionCode: string): Promise<void> {
  const { data } = await getDropByCode(sessionCode);
  if (data && !data.is_destroyed) {
    await supabase.storage
      .from(PHANTOM_CONFIG.STORAGE_BUCKET)
      .remove([data.storage_path]);
    await supabase.rpc('destroy_drop_by_code', { p_code: sessionCode });
  }
}

/** Destroy a specific expired text (called from receiver when expiry detected) */
export async function destroyExpiredText(sessionCode: string): Promise<void> {
  await supabase.rpc('destroy_text_by_code', { p_code: sessionCode });
}

// ─── Cleanup ─────────────────────────────────────────────────

/** Cleanup all expired drops and texts (called by cron) */
export async function cleanupExpired(): Promise<{ dropsDeleted: number; textsDeleted: number }> {
  const now = new Date().toISOString();

  // Get expired drops
  const { data: expiredDrops } = await supabase
    .from('drops')
    .select('storage_path, session_code')
    .lt('expires_at', now)
    .eq('is_destroyed', false);

  // Delete storage blobs
  if (expiredDrops && expiredDrops.length > 0) {
    const paths = expiredDrops.map(d => d.storage_path);
    await supabase.storage.from(PHANTOM_CONFIG.STORAGE_BUCKET).remove(paths);

    // Mark as destroyed
    const codes = expiredDrops.map(d => d.session_code);
    await supabase
      .from('drops')
      .update({ is_destroyed: true })
      .in('session_code', codes);
  }

  // Mark expired texts as destroyed
  const { data: expiredTexts } = await supabase
    .from('secure_texts')
    .select('session_code')
    .lt('expires_at', now)
    .eq('is_destroyed', false);

  if (expiredTexts && expiredTexts.length > 0) {
    const codes = expiredTexts.map(t => t.session_code);
    await supabase
      .from('secure_texts')
      .update({ is_destroyed: true })
      .in('session_code', codes);
  }

  return {
    dropsDeleted: expiredDrops?.length || 0,
    textsDeleted: expiredTexts?.length || 0,
  };
}
