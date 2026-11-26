// Phantom - Shared Input Validation, Sanitization & Auth Utilities

const SAFE_CODE_REGEX = /^[A-Za-z0-9_-]{4,64}$/;
const SAFE_HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const PLACEHOLDER_CLEANUP_SECRETS = new Set([
  '',
  'phantom-cleanup-secret-change-me',
  'changeme',
  'secret',
]);

/** Validates an access/session/room/receiver token strictly against injection characters. */
export function isSafeCode(value: unknown): value is string {
  return typeof value === 'string' && SAFE_CODE_REGEX.test(value.trim());
}

/** Filters an arbitrary array down to safe alphanumeric/underscore/dash tokens, capped at maxItems. */
export function sanitizeCodeList(input: unknown, maxItems = 50): string[] {
  if (!Array.isArray(input)) return [];
  const result: string[] = [];
  const seen = new Set<string>();

  for (const entry of input) {
    if (result.length >= maxItems) break;
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!SAFE_CODE_REGEX.test(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/** Validates hex color strings to block inline CSS/attribute injection. */
export function sanitizeHexColor(value: unknown, fallback = '#6366f1'): string {
  return typeof value === 'string' && SAFE_HEX_COLOR_REGEX.test(value.trim())
    ? value.trim()
    : fallback;
}

/** Identifies SVG vector files which can execute embedded scripts if opened directly as top-level tabs. */
export function isSvgFilename(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext === 'svg' || ext === 'svgz';
}

/** Constant-time UTF-8 string equality check to prevent timing attacks across Node, Edge, and Browser. */
export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;

  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Verifies Bearer secret authorization for admin/cron endpoints.
 * Fails CLOSED in production when secrets are missing or still set to placeholders.
 */
export function verifyBearerSecret(
  authHeader: string | null,
  secret: string | undefined,
  isProduction = process.env.NODE_ENV === 'production'
): boolean {
  const normalizedSecret = (secret || '').trim();
  if (!normalizedSecret) {
    return !isProduction;
  }
  if (isProduction && PLACEHOLDER_CLEANUP_SECRETS.has(normalizedSecret)) {
    return false;
  }
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  return constantTimeEqual(authHeader, `Bearer ${normalizedSecret}`);
}
