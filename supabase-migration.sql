-- ============================================================
-- PHANTOM Database Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Drops table (encrypted file metadata)
CREATE TABLE IF NOT EXISTS drops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code VARCHAR(10) UNIQUE NOT NULL,
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
  session_code VARCHAR(10) UNIQUE NOT NULL,
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
  session_code VARCHAR(10) UNIQUE NOT NULL,
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

-- Allow anonymous reads/writes (the security comes from E2E encryption + session codes)
CREATE POLICY "Allow anonymous insert on drops" ON drops FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous select on drops" ON drops FOR SELECT USING (true);
CREATE POLICY "Allow anonymous update on drops" ON drops FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete on drops" ON drops FOR DELETE USING (true);

CREATE POLICY "Allow anonymous insert on secure_texts" ON secure_texts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous select on secure_texts" ON secure_texts FOR SELECT USING (true);
CREATE POLICY "Allow anonymous update on secure_texts" ON secure_texts FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete on secure_texts" ON secure_texts FOR DELETE USING (true);

CREATE POLICY "Allow anonymous insert on clipboard_sessions" ON clipboard_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous select on clipboard_sessions" ON clipboard_sessions FOR SELECT USING (true);
CREATE POLICY "Allow anonymous update on clipboard_sessions" ON clipboard_sessions FOR UPDATE USING (true);

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
