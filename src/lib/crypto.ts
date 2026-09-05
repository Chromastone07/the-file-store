// PHANTOM — E2E Encryption Engine
// All cryptographic operations happen client-side. The server NEVER sees plaintext data or keys.

import { PHANTOM_CONFIG } from './config';

// ─── Key Generation ───────────────────────────────────────────

/** Generate a random AES-GCM-256 encryption key */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: PHANTOM_CONFIG.AES_ALGORITHM, length: PHANTOM_CONFIG.AES_KEY_LENGTH },
    true, // extractable — we need to export it for URL fragment
    ['encrypt', 'decrypt']
  );
}

/** Generate a random initialization vector */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(PHANTOM_CONFIG.IV_LENGTH));
}

/** Generate a random salt for PBKDF2 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

// ─── Key Serialization ───────────────────────────────────────

/** Export a CryptoKey to base64url string (for URL fragment) */
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64Url(raw);
}

/** Import a CryptoKey from base64url string (from URL fragment) */
export async function importKeyFromBase64(base64: string): Promise<CryptoKey> {
  const raw = base64UrlToArrayBuffer(base64);
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: PHANTOM_CONFIG.AES_ALGORITHM, length: PHANTOM_CONFIG.AES_KEY_LENGTH },
    false, // not extractable after import
    ['decrypt']
  );
}

// ─── Password-Based Key Derivation ──────────────────────────

/** Derive an AES-GCM-256 key from a user passphrase using PBKDF2 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PHANTOM_CONFIG.PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: PHANTOM_CONFIG.AES_ALGORITHM, length: PHANTOM_CONFIG.AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── File Encryption / Decryption ────────────────────────────

export interface EncryptedPayload {
  ciphertext: ArrayBuffer;
  iv: string;       // base64
  salt?: string;     // base64 (if password-protected)
}

/** Encrypt a file's ArrayBuffer with AES-GCM-256 */
export async function encryptData(
  data: ArrayBuffer,
  key: CryptoKey
): Promise<{ ciphertext: ArrayBuffer; iv: string }> {
  const iv = generateIV();
  const ciphertext = await crypto.subtle.encrypt(
    { name: PHANTOM_CONFIG.AES_ALGORITHM, iv: iv as BufferSource },
    key,
    data
  );
  return { ciphertext, iv: arrayBufferToBase64(iv.buffer as ArrayBuffer) };
}

/** Decrypt an encrypted ArrayBuffer with AES-GCM-256 */
export async function decryptData(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  ivBase64: string
): Promise<ArrayBuffer> {
  const iv = base64ToArrayBuffer(ivBase64);
  return crypto.subtle.decrypt(
    { name: PHANTOM_CONFIG.AES_ALGORITHM, iv: iv as BufferSource },
    key,
    ciphertext
  );
}

/** Encrypt a text string */
export async function encryptText(
  text: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const iv = generateIV();
  const encrypted = await crypto.subtle.encrypt(
    { name: PHANTOM_CONFIG.AES_ALGORITHM, iv: iv as BufferSource },
    key,
    data
  );
  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/** Decrypt a text string */
export async function decryptText(
  ciphertextBase64: string,
  key: CryptoKey,
  ivBase64: string
): Promise<string> {
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);
  const iv = base64ToArrayBuffer(ivBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: PHANTOM_CONFIG.AES_ALGORITHM, iv: iv as BufferSource },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

// ─── Password-Protected Encryption ──────────────────────────

/** Encrypt data with an additional password layer on top of the main key */
export async function encryptWithPassword(
  data: ArrayBuffer,
  password: string
): Promise<{ ciphertext: ArrayBuffer; iv: string; salt: string }> {
  const salt = generateSalt();
  const key = await deriveKeyFromPassword(password, salt);
  const iv = generateIV();
  const ciphertext = await crypto.subtle.encrypt(
    { name: PHANTOM_CONFIG.AES_ALGORITHM, iv: iv as BufferSource },
    key,
    data
  );
  return {
    ciphertext,
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
  };
}

/** Decrypt password-protected data */
export async function decryptWithPassword(
  ciphertext: ArrayBuffer,
  password: string,
  ivBase64: string,
  saltBase64: string
): Promise<ArrayBuffer> {
  const salt = new Uint8Array(base64ToArrayBuffer(saltBase64));
  const key = await deriveKeyFromPassword(password, salt);
  const iv = base64ToArrayBuffer(ivBase64);
  return crypto.subtle.decrypt(
    { name: PHANTOM_CONFIG.AES_ALGORITHM, iv: iv as BufferSource },
    key,
    ciphertext
  );
}

// ─── Hashing (For Zero-Knowledge Routing) ────────────────────

/** Hash a string using SHA-256 and return hex string */
export async function hashString(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 32); // 32 chars is enough for unique routing ID
}

// ─── Session Code Generation ─────────────────────────────────

/** Generate a cryptographically random session code */
export function generateSessionCode(length?: number): string {
  const { SESSION_CODE_ALPHABET, SESSION_CODE_LENGTH } = PHANTOM_CONFIG;
  const finalLength = length || SESSION_CODE_LENGTH;
  const randomValues = crypto.getRandomValues(new Uint8Array(finalLength));
  let code = '';
  for (let i = 0; i < finalLength; i++) {
    code += SESSION_CODE_ALPHABET[randomValues[i] % SESSION_CODE_ALPHABET.length];
  }
  return code;
}

// ─── Encoding Utilities ──────────────────────────────────────

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  return arrayBufferToBase64(buffer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return base64ToArrayBuffer(base64);
}

/** Securely wipe an ArrayBuffer by zeroing all bytes */
export function secureWipe(buffer: ArrayBuffer): void {
  new Uint8Array(buffer).fill(0);
}
