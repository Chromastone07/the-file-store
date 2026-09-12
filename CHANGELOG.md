# PHANTOM Project Changelog

All notable changes to this project will be documented in this file, structured chronologically as isolated events to ensure the timeline can be clearly followed.

---
**Timestamp:** 2026-09-12 23:46

**Q: What change was made?**
**A:** Fixed a Stored Cross-Site Scripting (XSS) vulnerability in the `DocumentViewer` component.

**Q: Why was this change needed?**
**A:** The `DocumentViewer` component parsed and rendered Markdown directly to the DOM using `dangerouslySetInnerHTML` without any HTML sanitization. Because files are E2E-encrypted, the backend couldn't scan for malware, meaning an attacker could upload malicious JavaScript that would execute in any user's browser who opened the file.

**Q: How was the change implemented?**
**A:** Installed the `dompurify` and `@types/dompurify` libraries. Updated `src/components/viewers/DocumentViewer.tsx` to pass the raw markdown string through `DOMPurify.sanitize()` before injecting it into the DOM, completely neutralizing the threat.

---
**Timestamp:** 2026-09-12 23:48

**Q: What change was made?**
**A:** Secured the Supabase Database by replacing unrestricted Row Level Security (RLS) policies with strict Remote Procedure Calls (RPCs).

**Q: Why was this change needed?**
**A:** The previous RLS policies for the database used `USING (true)` for `SELECT`, `UPDATE`, and `DELETE` actions. Since the app relies on anonymous access instead of user logins, this flaw meant anyone with the public database key could query all active sessions and arbitrarily delete or corrupt all files across the entire platform, creating a massive Denial of Service (DoS) vulnerability.

**Q: How was the change implemented?**
**A:** 
1. Modified `supabase-migration.sql` to revoke the unrestricted `SELECT`, `UPDATE`, and `DELETE` policies on all tables (`drops`, `secure_texts`, `clipboard_sessions`). 
2. Created restricted `SECURITY DEFINER` Postgres functions (RPCs) to ensure data can only be accessed or modified if the client provides the exact `session_code`. 
3. Refactored `src/lib/supabase.ts` to call these new secure RPC endpoints instead of making direct database queries.

---
**Timestamp:** 2026-09-13 00:27

**Q: What change was made?**
**A:** Added a "Download All (.zip)" capability for bulk sharing.

**Q: Why was this change needed?**
**A:** When multiple files are shared in a single drop, users previously had to download each file individually. To provide real-world utility and ease of use, a bulk download feature was necessary, but it had to operate entirely on the client side to preserve zero-knowledge E2E encryption.

**Q: How was the change implemented?**
**A:** Utilized the `fflate` library to dynamically bundle all decrypted file blobs into a single `.zip` archive directly within the browser's memory. This is completely localized and happens instantly without server processing.

---
**Timestamp:** 2026-09-13 00:28

**Q: What change was made?**
**A:** Added native in-browser previews for Audio, DOCX, and XLSX file formats.

**Q: Why was this change needed?**
**A:** A core goal is to provide maximum ease to the user without breaking existing E2E security. Instead of forcing users to download complex document formats just to see their contents, we can parse them safely in the browser.

**Q: How was the change implemented?**
**A:** 
1. Added `mammoth` and `xlsx` dependencies to parse DOCX into HTML and XLSX into HTML tables, respectively. 
2. Passed the resulting HTML strings through `DOMPurify` to ensure malicious scripts embedded in documents cannot execute.
3. Created `SpreadsheetViewer`, `WordViewer`, and `AudioViewer` (using standard HTML5 `<audio>` tags).
4. Mapped audio extensions (`mp3`, `wav`, etc.) to a new `audio` category in `src/lib/utils.ts`.

---
**Timestamp:** 2026-09-13 00:29

**Q: What change was made?**
**A:** Enhanced the visual urgency of the Countdown Timer.

**Q: Why was this change needed?**
**A:** To improve user awareness when a session is about to self-destruct, providing a stronger visual cue that time is running out.

**Q: How was the change implemented?**
**A:** Modified `CountdownTimer.tsx` so that when the timer falls below 60 seconds, the UI transitions to a pulsing red "danger" state with a warning icon, overriding the default warning state.

---
**Timestamp:** 2026-09-13 00:39

**Q: What change was made?**
**A:** Fixed Next.js terminal warning related to smooth scrolling.

**Q: Why was this change needed?**
**A:** Next.js throws an error/warning in the development console when `scroll-behavior: smooth` is used globally without an explicit opt-out on the `<html>` tag.

**Q: How was the change implemented?**
**A:** Added the `data-scroll-behavior="smooth"` attribute to the `<html lang="en">` tag inside `src/app/layout.tsx`.

---
**Timestamp:** 2026-09-13 01:00

**Q: What change was made?**
**A:** Made the database migration SQL script idempotent and widened the `session_code` and `group_code` columns.

**Q: Why was this change needed?**
**A:** When running the previous security update on an existing database, the `CREATE POLICY` statements threw errors because the policies already existed. Furthermore, the `session_code` and `group_code` columns were `VARCHAR(10)`, but they needed to hold the new 32-character SHA-256 hashes implemented to secure multi-file uploads.

**Q: How was the change implemented?**
**A:** Updated `supabase-migration.sql` to use `DROP POLICY IF EXISTS` before recreating them, and added `ALTER TABLE` statements to dynamically resize the `session_code` and `group_code` columns to `VARCHAR(64)` across all relevant tables.

---
**Timestamp:** 2026-09-13 01:08

**Q: What change was made?**
**A:** Fixed the "Burn After Reading" logic so files stay open until the user explicitly closes the viewer or the media ends.

**Q: Why was this change needed?**
**A:** Previously, the server deleted the file immediately upon being opened. The frontend's polling interval detected this deletion and immediately kicked the user out (showing "Already opened and destroyed"), preventing them from actually viewing the file.

**Q: How was the change implemented?**
**A:** 
1. Modified the polling interval in `src/app/d/[code]/page.tsx` to stop forcing a full page expiration while a user is actively viewing a file.
2. The server still securely deletes the file instantly on open, but the frontend's cleanup effect now waits until the modal is closed before wiping the file from memory and showing the "Destroyed" screen.
3. Added an `onMediaEnded` callback to `VideoPlayer.tsx`, `AudioViewer.tsx`, and `FileViewerModal.tsx` so video and audio files automatically trigger their own destruction once they finish playing.

---
