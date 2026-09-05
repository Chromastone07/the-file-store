<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PHANTOM Project

## Architecture
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Backend:** Supabase (PostgreSQL + Storage)
- **Styling:** Tailwind CSS v4 + CSS custom properties (--phantom-*)
- **Encryption:** Web Crypto API (AES-GCM-256), client-side only
- **Path alias:** @/* → ./src/*

## Key Files
- `src/lib/config.ts` — All configurable constants (file size cap at 50MB, expiry presets, etc.)
- `src/lib/crypto.ts` — E2E encryption engine (AES-GCM-256, PBKDF2)
- `src/lib/supabase.ts` — Database operations + storage helpers
- `src/lib/utils.ts` — File categorization, formatting, link generation
- `src/lib/metadata.ts` — EXIF/metadata stripping
- `src/lib/stealth.ts` — Zero-trace lab mode engine

## Design System
- Dark theme (default): CSS variables on :root
- Light theme: CSS variables on [data-theme="light"]
- All colors use var(--phantom-*) variables
- Minimal, clean aesthetic inspired by Antigravity/Vercel
- Accessibility: prefers-reduced-motion, ARIA labels, keyboard nav

## Security Model
- Files encrypted client-side before upload (AES-GCM-256)
- Decryption key in URL #fragment (never sent to server)
- Server is zero-knowledge — stores only encrypted blobs
- Private storage bucket with signed URLs (60s expiry)
- Session codes generated with cryptographic randomness
