// PHANTOM Configuration
// All configurable constants in one place for easy updates

export const PHANTOM_CONFIG = {
  // File size limits
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB - change this when upgrading Supabase plan
  MAX_FILE_SIZE_DISPLAY: '50MB',

  // Session codes
  SESSION_CODE_LENGTH: 8,
  SESSION_CODE_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // No I/1/O/0 confusion

  // Encryption
  AES_KEY_LENGTH: 256,
  AES_ALGORITHM: 'AES-GCM' as const,
  PBKDF2_ITERATIONS: 100_000,
  IV_LENGTH: 12,

  // Expiry presets (in minutes)
  EXPIRY_PRESETS: [
    { label: '5 min', value: 5 },
    { label: '15 min', value: 15 },
    { label: '1 hour', value: 60 },
    { label: '6 hours', value: 360 },
    { label: '24 hours', value: 1440 },
    { label: '3 days', value: 4320 },
    { label: '7 days', value: 10080 },
  ],
  DEFAULT_EXPIRY_MINUTES: 1440, // 24 hours

  // Stealth mode
  INACTIVITY_TIMEOUT_MS: 90_000, // 90 seconds
  PANIC_REDIRECT_URL: 'https://en.wikipedia.org/wiki/Main_Page',

  // Supabase
  STORAGE_BUCKET: 'drops',
  SIGNED_URL_EXPIRY: 60, // seconds

  // App
  APP_NAME: 'PHANTOM',
  APP_TAGLINE: 'Share. Access. Vanish.',
  APP_DESCRIPTION: 'Anonymous, end-to-end encrypted, ephemeral data sharing. No accounts. No traces. No compromises.',
} as const;

export type ExpiryPreset = typeof PHANTOM_CONFIG.EXPIRY_PRESETS[number];
