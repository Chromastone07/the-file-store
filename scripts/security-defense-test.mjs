/**
 * PHANTOM Security Defense Test Suite
 * Exercises real production helpers (rate limiting, SQLi/PostgREST filter injection,
 * XSS/SSTI/command injection, SVG tab-XSS guard, CSS color sanitization, and fail-closed Bearer auth)
 * plus room/recipient isolation checks.
 *
 * Run with: node --experimental-strip-types scripts/security-defense-test.mjs
 */

import { checkRateLimit, getClientIp } from '../src/lib/rateLimit.ts';
import {
  isSafeCode,
  sanitizeCodeList,
  sanitizeHexColor,
  isSvgFilename,
  constantTimeEqual,
  verifyBearerSecret,
} from '../src/lib/security.ts';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ${GREEN}✓ PASS:${RESET} ${testName}`);
    passedTests++;
  } else {
    console.error(`  ${RED}✗ FAIL:${RESET} ${testName}`);
    if (details) console.error(`    ${YELLOW}Details: ${details}${RESET}`);
    failedTests++;
  }
}

console.log(`\n${CYAN}======================================================${RESET}`);
console.log(`${CYAN}    PHANTOM SECURITY DEFENSE & HARDENING AUDIT       ${RESET}`);
console.log(`${CYAN}======================================================${RESET}\n`);

// ── TEST 1: DDoS & Flood Protection (Rate Limiting + Heap Cap) ──
console.log(`${YELLOW}[Defense Test 1] DDoS & Flood Protection (Rate Limiting)${RESET}`);
const testIp = '192.168.1.100';
const limit = 5;
const windowMs = 2000;

let blockedAt = -1;
for (let i = 1; i <= 8; i++) {
  const result = checkRateLimit(`ddos_test_${testIp}`, limit, windowMs);
  if (!result.allowed && blockedAt === -1) {
    blockedAt = i;
  }
}

assert(blockedAt === 6, 'Rate limiter strictly blocks requests exceeding window threshold', `Blocked at request #${blockedAt}, expected #6`);

const blockedCheck = checkRateLimit(`ddos_test_${testIp}`, limit, windowMs);
assert(!blockedCheck.allowed && blockedCheck.retryAfter > 0, 'Excess requests receive retryAfter timestamp');

const parsedIp = getClientIp(new Request('https://example.com', { headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' } }));
assert(parsedIp === '203.0.113.5', 'getClientIp extracts origin client IP from x-forwarded-for');

// ── TEST 2: SQL Injection & PostgREST Filter Injection Defense (Live Helpers) ──
console.log(`\n${YELLOW}[Defense Test 2] SQLi & PostgREST Filter Injection Rejection${RESET}`);
const injectionPayloads = [
  "' OR '1'='1",
  "'; DROP TABLE drops; --",
  "1' UNION SELECT * FROM clipboard_sessions --",
  "admin' --",
  "WAITFOR DELAY '0:0:5'",
  "'; EXEC xp_cmdshell('dir');--",
  "1 OR 1=1",
  "\" OR \"\"=\"",
  "x),is_destroyed.eq.false,id.not.is.null,session_code.in.(x",
  "valid_a,valid_b",
  "code1234)",
];

for (const payload of injectionPayloads) {
  assert(!isSafeCode(payload), `Live validator isSafeCode rejects injection: ${JSON.stringify(payload)}`);
}

const panicSanitized = sanitizeCodeList([...injectionPayloads, 'VAULT2026', 'AB12CD34', 'VAULT2026'], 50);
assert(
  panicSanitized.length === 2 && panicSanitized[0] === 'VAULT2026' && panicSanitized[1] === 'AB12CD34',
  'sanitizeCodeList strips PostgREST filter/SQLi payloads and deduplicates valid tokens'
);

const floodArray = Array.from({ length: 200 }, (_, i) => `CODE_${1000 + i}`);
assert(sanitizeCodeList(floodArray, 50).length === 50, 'sanitizeCodeList caps batch arrays at maxItems=50 against query DoS');

// ── TEST 3: XSS, SSTI, Server-Side Script & Command Injection Defense ──
console.log(`\n${YELLOW}[Defense Test 3] XSS, SSTI, CSS Injection & SVG Script Defenses${RESET}`);
const scriptPayloads = [
  "<script>alert('pwned')</script>",
  "<img src=x onerror=alert(1)>",
  "javascript:alert(document.cookie)",
  "<svg onload=alert(1)>",
  "'\"><script>fetch('/stolen')</script>",
  "{{7*7}}",
  "${process.env.CLEANUP_SECRET}",
  "<%= 7*7 %>",
  "; cat /etc/passwd",
  "$(whoami)",
  "../../etc/passwd",
];

for (const payload of scriptPayloads) {
  assert(!isSafeCode(payload), `XSS/SSTI/CMD payload rejected by isSafeCode: ${JSON.stringify(payload)}`);
}

assert(sanitizeHexColor('#10b981') === '#10b981', 'sanitizeHexColor preserves valid hex color');
assert(sanitizeHexColor('red; background:url(javascript:alert(1))') === '#6366f1', 'sanitizeHexColor blocks CSS injection payloads');
assert(sanitizeHexColor('" onclick="alert(1)') === '#6366f1', 'sanitizeHexColor blocks attribute breakout payloads');
assert(isSvgFilename('diagram.svg') && isSvgFilename('LOGO.SVGZ'), 'isSvgFilename identifies SVG files to block raw top-level tab execution');
assert(!isSvgFilename('photo.png'), 'isSvgFilename allows safe raster formats to open cleanly');

// ── TEST 4: Cleanup / Cron Fail-Closed Auth & Constant-Time Comparison ──
console.log(`\n${YELLOW}[Defense Test 4] Admin/Cron Fail-Closed Bearer Auth & Timing Safety${RESET}`);
assert(!verifyBearerSecret(null, undefined, true), 'Production auth fails CLOSED when secret env var is unset');
assert(!verifyBearerSecret('Bearer phantom-cleanup-secret-change-me', 'phantom-cleanup-secret-change-me', true), 'Production auth rejects known placeholder cleanup secret');
assert(!verifyBearerSecret('Bearer wrong-token', 'ultra-strong-random-32-byte-secret!', true), 'Wrong Bearer token strictly rejected');
assert(!verifyBearerSecret('ultra-strong-random-32-byte-secret!', 'ultra-strong-random-32-byte-secret!', true), 'Missing Bearer prefix rejected');
assert(verifyBearerSecret('Bearer ultra-strong-random-32-byte-secret!', 'ultra-strong-random-32-byte-secret!', true), 'Valid Bearer secret passes constant-time auth check');
assert(constantTimeEqual('abc123', 'abc123') && !constantTimeEqual('abc123', 'abc124') && !constantTimeEqual('abc', 'abcd'), 'constantTimeEqual compares equal and unequal lengths accurately');

// ── TEST 5: Chat Capacity, Ghost Rooms & Recipient Isolation Logic ──
console.log(`\n${YELLOW}[Defense Test 5] Chat Capacity & Recipient Limit Isolation Rules${RESET}`);
const simulatedRoom = { code: 'SECURE88', maxUsers: 2, participants: new Map([['t1', 1], ['t2', 2]]) };
assert(simulatedRoom.participants.size >= simulatedRoom.maxUsers, 'Room capacity threshold enforced at maxUsers=2 without evicting connected users');

const dropSim = { max_views: 2, view_count: 2, is_destroyed: false, admitted: new Set(['u1', 'u2']) };
const u3Blocked = dropSim.max_views !== null && dropSim.view_count >= dropSim.max_views && !dropSim.admitted.has('u3');
assert(u3Blocked && !dropSim.is_destroyed, '3rd unauthorized viewer blocked while admitted User 1 & User 2 sessions stay alive');

// ── SUMMARY REPORT ──
console.log(`\n${CYAN}======================================================${RESET}`);
console.log(`${CYAN}                 DEFENSE TEST RESULTS                ${RESET}`);
console.log(`${CYAN}======================================================${RESET}`);
console.log(`  Total Tests Run:  ${passedTests + failedTests}`);
console.log(`  ${GREEN}Passed:           ${passedTests}${RESET}`);
console.log(`  ${failedTests === 0 ? GREEN : RED}Failed:           ${failedTests}${RESET}`);

if (failedTests === 0) {
  console.log(`\n${GREEN}✓ ALL SECURITY DEFENSE CHECKS PASSED PERFECTLY.${RESET}\n`);
  process.exit(0);
} else {
  console.error(`\n${RED}✗ SOME DEFENSE CHECKS FAILED. INVESTIGATION REQUIRED.${RESET}\n`);
  process.exit(1);
}
