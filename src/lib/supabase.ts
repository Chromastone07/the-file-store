// Phantom - Supabase Client & Database Helpers

import { createClient } from '@supabase/supabase-js';
import { WISP_CONFIG } from './config';
import { getOrCreateReceiverToken } from './crypto';

// ─── Client ──────────────────────────────────────────────────

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
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
  download_count?: number;
  state?: 'active' | 'consuming' | 'destroyed' | 'expired';
  destroy_reason?: 'ttl' | 'burn' | 'manual' | 'panic';
  consumed_at?: string;
  last_accessed_at?: string;
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
  download_count?: number;
  state?: 'active' | 'consuming' | 'destroyed' | 'expired';
  destroy_reason?: 'ttl' | 'burn' | 'manual' | 'panic';
  consumed_at?: string;
  last_accessed_at?: string;
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
    .from(WISP_CONFIG.STORAGE_BUCKET)
    .upload(storagePath, encryptedData, {
      contentType: 'application/octet-stream',
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
    .from(WISP_CONFIG.STORAGE_BUCKET)
    .createSignedUrl(storagePath, WISP_CONFIG.SIGNED_URL_EXPIRY);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Confirm access receipt via atomic server-side POST */
export async function confirmReceipt(
  code: string,
  type: 'drop' | 'text',
  eventType: 'view' | 'download'
): Promise<{ isDestroyed: boolean; viewCount: number; downloadCount: number }> {
  try {
    const receiverToken = getOrCreateReceiverToken();
    const res = await fetch('/api/receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, type, eventType, receiverToken }),
    });

    if (!res.ok) {
      if (res.status === 410) {
        return { isDestroyed: true, viewCount: 0, downloadCount: 0 };
      }
      throw new Error(`Receipt status: ${res.status}`);
    }

    const json = await res.json();
    return {
      isDestroyed: !!json.isDestroyed,
      viewCount: json.viewCount || 0,
      downloadCount: json.downloadCount || 0,
    };
  } catch (err) {
    console.warn('Receipt confirmation network fallback:', err);
    return { isDestroyed: false, viewCount: 0, downloadCount: 0 };
  }
}

/** Record view after client-side decryption succeeds */
export async function recordView(sessionCode: string, _burnAfterReading?: boolean): Promise<void> {
  void _burnAfterReading;
  await confirmReceipt(sessionCode, 'drop', 'view');
}

/** Record download after file is fully saved */
export async function recordDownload(sessionCode: string): Promise<void> {
  await confirmReceipt(sessionCode, 'drop', 'download');
}

// ─── Clipboard Sessions (Database limit enforcement) ────────

export async function createClipboardSession(record: ClipboardSessionRecord) {
  return await supabase.from('clipboard_sessions').insert(record);
}

export async function getClipboardSession(sessionCode: string) {
  const { data, error } = await supabase
    .rpc('get_clipboard_session', { p_code: sessionCode })
    .single();
  return { data: data as ClipboardSessionRecord | null, error };
}

export async function deleteClipboardSession(sessionCode: string) {
  return await supabase.rpc('delete_clipboard_session', { p_code: sessionCode });
}

/** Delete a drop completely */
export async function destroyDrop(sessionCode: string): Promise<void> {
  // Fetch drop first to clean up its storage blob
  const { data } = await getDropByCode(sessionCode);
  if (data) {
    await supabase.storage.from(WISP_CONFIG.STORAGE_BUCKET).remove([data.storage_path]);
  }

  // Also destroy any multi-file group members
  const { data: groupDrops } = await getDropsByLookupCode(sessionCode);
  if (groupDrops && groupDrops.length > 0) {
    const paths = groupDrops.map(d => d.storage_path);
    await supabase.storage.from(WISP_CONFIG.STORAGE_BUCKET).remove(paths);
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
export async function recordTextView(sessionCode: string, _burnAfterReading?: boolean): Promise<void> {
  void _burnAfterReading;
  await confirmReceipt(sessionCode, 'text', 'view');
}

/** Delete a secure text completely */
export async function destroySecureText(sessionCode: string): Promise<void> {
  await supabase.rpc('destroy_text_by_code', { p_code: sessionCode });
}

// ─── Targeted Expiry Cleanup ─────────────────────────────────

export async function destroyExpiredDrop(sessionCode: string): Promise<void> {
  const { data } = await getDropByCode(sessionCode);
  if (data && !data.is_destroyed) {
    await supabase.storage.from(WISP_CONFIG.STORAGE_BUCKET).remove([data.storage_path]);
    await supabase.rpc('destroy_drop_by_code', { p_code: sessionCode });
  }
}

export async function destroyExpiredText(sessionCode: string): Promise<void> {
  await supabase.rpc('destroy_text_by_code', { p_code: sessionCode });
}

/** Cleanup helper using targeted RPCs */
export async function cleanupExpired(): Promise<{ dropsDeleted: number; textsDeleted: number }> {
  return { dropsDeleted: 0, textsDeleted: 0 };
}
