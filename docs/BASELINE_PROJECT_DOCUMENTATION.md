# PHANTOM — Baseline Architecture & Feature Documentation
> **Scope:** Project state, features, and technical architecture *prior* to the work conducted in this conversation.

---

## 1. Project Overview & Core Philosophy

**PHANTOM** (formerly "The File Store / The Vault") is an anonymous, ephemeral, zero-knowledge file and data sharing platform.

The core philosophy revolves around uncompromising zero-knowledge privacy:
1. **Client-Side Only Encryption:** Files and text payloads are fully encrypted inside the user's browser using AES-GCM-256 before any network request is made.
2. **Zero-Knowledge Server:** The backend (Supabase PostgreSQL and Supabase S3 Storage) only ever receives and stores opaque, encrypted binary blobs (`application/octet-stream`).
3. **Decryption Keys Never Leave the Client:** The secret symmetric decryption key is appended exclusively into the URL fragment hash (e.g., `https://.../d/ABCDEFGH#<decryption_key>`). Because browsers never send URL fragments (`#`) across HTTP requests to the server, the server and intermediate proxies never see the decryption keys.
4. **Ephemeral Lifespans:** Uploads are assigned an expiration timer (configured up to 24 hours). Once expired, or upon single access ("Burn After Reading"), payloads are purged from memory and storage.

---

## 2. Technical Stack (Baseline)

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 with custom CSS design tokens (`--wisp-*` and `--phantom-*`) supporting dark mode (default `#07080f`) and light mode (`[data-theme="light"]`)
- **Backend & Database:** Supabase (PostgreSQL with Row Level Security and RPC functions)
- **Object Storage:** Supabase Storage private buckets accessed via short-lived signed URLs (60-second expiration)
- **Cryptography:** Web Crypto API (`SubtleCrypto` — AES-GCM-256, PBKDF2 with SHA-256 key derivation)
- **Client-Side Bundling:** `fflate` for client-side zip creation, `dompurify` for HTML sanitization
- **Document Parsers:** `mammoth` (DOCX to HTML), `xlsx` (Excel spreadsheets to HTML tables), `pdfjs-dist` (PDF rendering)

---

## 3. Baseline Feature Set & Implementation

### A. End-to-End Cryptography Engine (`src/lib/crypto.ts`)
- **Key Generation:** Generates high-entropy cryptographic keys using `crypto.getRandomValues()`.
- **Payload Encryption:** Uses AES-GCM-256 with an initialization vector (IV) and PBKDF2 salt. The resulting binary file bundles the salt, IV, and ciphertext into a single portable binary buffer.
- **Payload Decryption:** Extracts the salt, IV, and ciphertext from the uploaded blob, re-derives the symmetric key from the URL hash, and decrypts the payload in-memory.
- **Code Hashes:** Uses SHA-256 hashing (`hashString()`) to map access codes to database lookup keys so the plain access code is not exposed directly in database queries.

### B. File Drops (`src/app/drop/page.tsx` & `src/hooks/useFileUpload.ts`)
- **Multi-File Upload:** Allows users to select single or multiple files with a total size cap of 50 MB (`src/lib/config.ts`).
- **EXIF & Metadata Stripping (`src/lib/metadata.ts`):** Before encrypting images and documents, client-side routines scrub sensitive EXIF metadata, camera serials, author names, and GPS coordinate tags.
- **Burn-After-Reading (BAR):** Users can toggle single-view mode, instructing the platform to immediately delete the file once viewed.
- **Local Storage Receipts:** The sender's browser saves upload receipts locally so they can monitor active drops without requiring user accounts or logins.

### C. Encrypted Text Snippets (`src/app/text/page.tsx`)
- Provides a distraction-free notepad for sharing passwords, API tokens, sensitive logs, or private notes.
- Text is encrypted in-memory with AES-GCM-256 and assigned an 8-character access code.
- Supports Burn-After-Reading and auto-destruction countdowns.

### D. Ephemeral Live Chat & Clipboard (`src/app/chat/page.tsx`)
- Real-time ephemeral communication channel powered by Supabase Realtime channels.
- Supports peer-to-peer style temporary clipboard exchange and messaging.
- Ephemeral rooms auto-destruct when participants leave or the timer elapses.

### E. File Access & In-Browser Viewers (`src/app/d/[code]/page.tsx` & `src/components/viewers/`)
- When a recipient enters a code or visits a shared link:
  1. The encrypted blob is fetched via signed URL.
  2. The browser decrypts the blob in memory into a local Blob URL (`blob:https://...`).
  3. The file is previewed in-browser using specialized zero-cache viewers:
     - **Images & Photos:** `ImageViewer.tsx` with zoom, pan, and rotation.
     - **Audio:** `AudioViewer.tsx` with waveform/HTML5 audio controls.
     - **Video:** `VideoPlayer.tsx` with custom controls and `onMediaEnded` auto-burn hook.
     - **PDF Documents:** `PDFViewer.tsx` rendering via PDF.js worker.
     - **Word Documents (.docx):** `WordViewer.tsx` utilizing `mammoth` and `DOMPurify`.
     - **Excel Spreadsheets (.xlsx, .csv):** `SpreadsheetViewer.tsx` utilizing `xlsx` and `DOMPurify`.
     - **Code & Markdown:** `CodeViewer.tsx` with syntax highlighting and `DocumentViewer.tsx`.
     - **Bulk Downloads:** "Download All (.zip)" uses `fflate` to bundle all decrypted files into a single zip archive in-memory without server involvement.

### F. Global Session Dock (`src/components/ui/SessionDock.tsx`)
- A persistent widget docked at the bottom of the screen.
- Tracks all active sessions stored in `GlobalSessionContext.tsx`.
- Monitors countdown timers and handles active viewer modal states.

### G. Stealth & Panic Mode (`src/lib/stealth.ts` & `src/hooks/useStealthMode.ts`)
- **Emergency Panic Redirect:** Instant redirect to a decoy site (e.g., Google or Wikipedia) while wiping local session storage and in-memory caches.
- **Inactivity Wipe:** Configurable auto-wipe when window focus is lost or after prolonged user inactivity.

### H. Sender History & Management (`src/app/manage/page.tsx`)
- A client-only dashboard reading encrypted session receipts from `localStorage`.
- Displays time remaining, view counts, and provides a manual "Revoke / Destroy Now" button to delete active drops before their natural expiration.

### I. Database Security & Stored RPCs (`supabase-migration.sql` & `src/lib/supabase.ts`)
- Row Level Security (RLS) is locked down. Direct table queries (`SELECT * FROM drops`) are prohibited.
- Data access is mediated through `SECURITY DEFINER` Postgres functions (RPCs) requiring exact session codes and hashes (`get_drop_by_code`, `destroy_drop`, `record_drop_view`).
- Expired files are marked for deletion by scheduled cleanup workers (`/api/cron/cleanup`).

---

## 4. Architectural Limitations at Baseline (Before Our Work)

Prior to the updates in this chat, the platform faced several real-world UX and operational constraints:
1. **Manual Code Entry Only:** Mobile users had to manually type 8-character codes; there was no in-app camera scanner for shared QR codes.
2. **Web-Only Presence:** Users could not install Phantom as a native-feeling application (no PWA manifest, service worker, or app icons).
3. **Long Default Storage Expiration:** The default duration was set to 24 hours, causing unpurged files to accumulate on Supabase storage if users forgot to adjust the dropdown.
4. **Traffic Surge Vulnerability:** Under heavy database concurrency or pool exhaustion, uploads failed with raw database errors without clear user messaging.
5. **Theme Contrast Gaps:** Certain headlines used hardcoded white text, rendering them invisible when switching to light theme.
6. **Heavy Initial Bundle:** File viewers (`xlsx`, `mammoth`, `pdfjs-dist`) were loaded synchronously in the root layout, increasing initial JavaScript size and lowering PageSpeed scores.
