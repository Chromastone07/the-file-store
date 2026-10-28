// Phantom Configuration
// All configurable constants in one place for easy updates

export const PHANTOM_CONFIG = {
  // File size limits
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
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
  DEFAULT_EXPIRY_MINUTES: 5, // 5 minutes default (prevents DB file buildup)

  // Stealth mode & Grace period
  INACTIVITY_TIMEOUT_MS: 90_000, // 90 seconds
  PANIC_REDIRECT_URL: '/',
  ACCESS_GRACE_PERIOD_MS: 5_000, // 5 seconds grace after access begins

  // Supabase
  STORAGE_BUCKET: 'drops',
  SIGNED_URL_EXPIRY: 60, // seconds

  // App Metadata (No em dashes permitted)
  APP_NAME: 'Phantom',
  APP_TAGLINE: 'Share. Access. Vanish.',
  APP_DESCRIPTION: 'Anonymous, end-to-end encrypted, ephemeral data sharing. No accounts. No traces. No compromises.',
  
  // Storage Keys
  STORAGE_KEYS: {
    SENDER_HISTORY: 'phantom_sender_history',
    SESSION_DOCK: 'phantom_active_dock',
    RECEIVER_TOKEN: 'phantom_receiver_token',
    CHAT_PARTICIPANT: 'phantom_chat_participant',
    THEME: 'phantom_theme',
  },
} as const;

// Aliases for backwards compatibility
export const WISP_CONFIG = PHANTOM_CONFIG;
export type ExpiryPreset = typeof PHANTOM_CONFIG.EXPIRY_PRESETS[number];
