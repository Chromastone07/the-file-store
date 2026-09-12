-- ============================================================
-- PHANTOM Database Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Drops table (encrypted file metadata)
CREATE TABLE IF NOT EXISTS drops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code VARCHAR(64) UNIQUE NOT NULL,
  group_code VARCHAR(64),
  storage_path TEXT NOT NULL,
  encrypted_filename TEXT,
  file_type VARCHAR(100),
  file_size BIGINT,
  encryption_iv TEXT NOT NULL,
  encryption_salt TEXT,
  has_password BOOLEAN DEFAULT FALSE,
  burn_after_reading BOOLEAN DEFAULT FALSE,
  max_views INTEGER DEFAULT NULL,
  view_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  is_destroyed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Secure texts table
CREATE TABLE IF NOT EXISTS secure_texts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code VARCHAR(64) UNIQUE NOT NULL,
  encrypted_content TEXT NOT NULL,
  content_type VARCHAR(50) DEFAULT 'text',
  encryption_iv TEXT NOT NULL,
  encryption_salt TEXT,
  has_password BOOLEAN DEFAULT FALSE,
  burn_after_reading BOOLEAN DEFAULT FALSE,
  max_views INTEGER DEFAULT NULL,
  view_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  is_destroyed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Clipboard sessions table (for real-time clipboard sync)
CREATE TABLE IF NOT EXISTS clipboard_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code VARCHAR(64) UNIQUE NOT NULL,
  max_users INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drops_session_code ON drops(session_code);
CREATE INDEX IF NOT EXISTS idx_drops_expires_at ON drops(expires_at) WHERE is_destroyed = FALSE;
CREATE INDEX IF NOT EXISTS idx_secure_texts_session_code ON secure_texts(session_code);
CREATE INDEX IF NOT EXISTS idx_secure_texts_expires_at ON secure_texts(expires_at) WHERE is_destroyed = FALSE;
CREATE INDEX IF NOT EXISTS idx_clipboard_sessions_code ON clipboard_sessions(session_code);

-- 5. RLS Policies
ALTER TABLE drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE clipboard_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts only (the security comes from E2E encryption + session codes)
DROP POLICY IF EXISTS "Allow anonymous insert on drops" ON drops;
CREATE POLICY "Allow anonymous insert on drops" ON drops FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous insert on secure_texts" ON secure_texts;
CREATE POLICY "Allow anonymous insert on secure_texts" ON secure_texts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous insert on clipboard_sessions" ON clipboard_sessions;
CREATE POLICY "Allow anonymous insert on clipboard_sessions" ON clipboard_sessions FOR INSERT WITH CHECK (true);

-- Ensure columns can handle 32-character hashes if tables were already created
ALTER TABLE drops ALTER COLUMN session_code TYPE VARCHAR(64);
DO $$ BEGIN
    ALTER TABLE drops ADD COLUMN group_code VARCHAR(64);
EXCEPTION
    WHEN duplicate_column THEN
        ALTER TABLE drops ALTER COLUMN group_code TYPE VARCHAR(64);
END $$;
ALTER TABLE secure_texts ALTER COLUMN session_code TYPE VARCHAR(64);
ALTER TABLE clipboard_sessions ALTER COLUMN session_code TYPE VARCHAR(64);

-- (SELECT, UPDATE, and DELETE are strictly controlled via the SECURITY DEFINER functions below)

-- 6. RPC Functions for Secure Access
-- These functions run with elevated privileges (SECURITY DEFINER) but only expose data for a specific session code.

-- 6.1 Get Drop by Code
CREATE OR REPLACE FUNCTION get_drop_by_code(p_code VARCHAR)
RETURNS SETOF drops
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM drops WHERE session_code = p_code;
END;
$$ LANGUAGE plpgsql;

-- 6.2 Get Drops by Lookup Code (for multi-file groups)
CREATE OR REPLACE FUNCTION get_drops_by_lookup_code(p_code VARCHAR)
RETURNS SETOF drops
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM drops WHERE session_code = p_code OR group_code = p_code ORDER BY created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 6.3 Record Drop View & Optional Destroy
CREATE OR REPLACE FUNCTION record_drop_view(p_code VARCHAR, p_burn BOOLEAN)
RETURNS void
SECURITY DEFINER
AS $$
DECLARE
  v_view_count INTEGER;
  v_max_views INTEGER;
  v_should_destroy BOOLEAN;
BEGIN
  SELECT view_count, max_views INTO v_view_count, v_max_views FROM drops WHERE session_code = p_code;
  IF FOUND THEN
    v_should_destroy := p_burn OR (v_max_views IS NOT NULL AND (v_view_count + 1) >= v_max_views);
    UPDATE drops SET view_count = view_count + 1, is_destroyed = v_should_destroy WHERE session_code = p_code;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6.4 Destroy Drop by Code
CREATE OR REPLACE FUNCTION destroy_drop_by_code(p_code VARCHAR)
RETURNS void
SECURITY DEFINER
AS $$
BEGIN
  UPDATE drops SET is_destroyed = TRUE WHERE session_code = p_code OR group_code = p_code;
END;
$$ LANGUAGE plpgsql;

-- 6.5 Get Secure Text by Code
CREATE OR REPLACE FUNCTION get_secure_text_by_code(p_code VARCHAR)
RETURNS SETOF secure_texts
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM secure_texts WHERE session_code = p_code;
END;
$$ LANGUAGE plpgsql;

-- 6.6 Record Text View & Optional Destroy
CREATE OR REPLACE FUNCTION record_text_view(p_code VARCHAR, p_burn BOOLEAN)
RETURNS void
SECURITY DEFINER
AS $$
DECLARE
  v_view_count INTEGER;
  v_max_views INTEGER;
  v_should_destroy BOOLEAN;
BEGIN
  SELECT view_count, max_views INTO v_view_count, v_max_views FROM secure_texts WHERE session_code = p_code;
  IF FOUND THEN
    v_should_destroy := p_burn OR (v_max_views IS NOT NULL AND (v_view_count + 1) >= v_max_views);
    UPDATE secure_texts SET view_count = view_count + 1, is_destroyed = v_should_destroy WHERE session_code = p_code;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6.7 Destroy Text by Code
CREATE OR REPLACE FUNCTION destroy_text_by_code(p_code VARCHAR)
RETURNS void
SECURITY DEFINER
AS $$
BEGIN
  UPDATE secure_texts SET is_destroyed = TRUE WHERE session_code = p_code;
END;
$$ LANGUAGE plpgsql;

-- 6.8 Get Clipboard Session
CREATE OR REPLACE FUNCTION get_clipboard_session(p_code VARCHAR)
RETURNS SETOF clipboard_sessions
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM clipboard_sessions WHERE session_code = p_code;
END;
$$ LANGUAGE plpgsql;

-- 6.9 Delete Clipboard Session
CREATE OR REPLACE FUNCTION delete_clipboard_session(p_code VARCHAR)
RETURNS void
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM clipboard_sessions WHERE session_code = p_code;
END;
$$ LANGUAGE plpgsql;

-- 6. Create a private storage bucket for encrypted drops
-- NOTE: Run this in the Supabase Dashboard under Storage → New Bucket
-- Bucket name: "drops"
-- Public: OFF (private)
-- File size limit: 52428800 (50MB)
-- Allowed MIME types: Leave empty (allow all)

-- Storage RLS for the 'drops' bucket:
-- Go to Storage → Policies → drops bucket and add:
-- INSERT: Allow all (authenticated and anon)
-- SELECT: Allow all (we use signed URLs)
-- DELETE: Allow all (for cleanup)

-- 7. Auto-cleanup function (optional - for Supabase Edge Functions)
-- This function deletes expired drops. Call it via a cron job.
CREATE OR REPLACE FUNCTION cleanup_expired_drops()
RETURNS void AS $$
BEGIN
  -- Delete storage objects for expired drops
  -- Note: Actual storage deletion needs to be done via the API
  
  -- Mark expired drops as destroyed
  UPDATE drops 
  SET is_destroyed = TRUE 
  WHERE expires_at < NOW() AND is_destroyed = FALSE;
  
  -- Mark expired texts as destroyed
  UPDATE secure_texts 
  SET is_destroyed = TRUE 
  WHERE expires_at < NOW() AND is_destroyed = FALSE;
  
  -- Clean up old clipboard sessions
  DELETE FROM clipboard_sessions 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
