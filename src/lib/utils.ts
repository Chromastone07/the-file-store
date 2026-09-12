// PHANTOM — Shared Utilities

// ─── File Categories ─────────────────────────────────────────

export type FileCategory = 'image' | 'video' | 'audio' | 'pdf' | 'code' | 'document' | 'archive' | 'presentation' | 'spreadsheet' | 'other';

const FILE_CATEGORIES: Record<string, FileCategory> = {
  // Images
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', ico: 'image', avif: 'image',
  // Video
  mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video', m4v: 'video',
  // Audio
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio', aac: 'audio',
  // PDF
  pdf: 'pdf',
  // Code
  js: 'code', jsx: 'code', ts: 'code', tsx: 'code', py: 'code', java: 'code', c: 'code', cpp: 'code',
  h: 'code', hpp: 'code', cs: 'code', go: 'code', rs: 'code', rb: 'code', php: 'code',
  swift: 'code', kt: 'code', scala: 'code', r: 'code', sql: 'code', sh: 'code', bash: 'code',
  html: 'code', css: 'code', scss: 'code', less: 'code', json: 'code', xml: 'code', yaml: 'code', yml: 'code',
  toml: 'code', ini: 'code', cfg: 'code', env: 'code', gitignore: 'code', dockerfile: 'code',
  makefile: 'code', cmake: 'code', gradle: 'code',
  // Documents
  txt: 'document', md: 'document', rtf: 'document', log: 'document', csv: 'document',
  doc: 'document', docx: 'document',
  // Presentations
  ppt: 'presentation', pptx: 'presentation', key: 'presentation',
  // Spreadsheets
  xls: 'spreadsheet', xlsx: 'spreadsheet',
  // Archives
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
};

/** Get the category of a file based on its extension */
export function getFileCategory(filename: string): FileCategory {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_CATEGORIES[ext] || 'other';
}

/** Get the file extension */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/** Check if a file can be previewed in-browser */
export function isPreviewable(filename: string): boolean {
  const category = getFileCategory(filename);
  return ['image', 'video', 'audio', 'pdf', 'code', 'document', 'spreadsheet', 'presentation'].includes(category);
}

// ─── Prism.js Language Mapping ───────────────────────────────

const PRISM_LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  py: 'python', java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp',
  go: 'go', rs: 'rust', rb: 'ruby', php: 'php', swift: 'swift',
  kt: 'kotlin', scala: 'scala', r: 'r', sql: 'sql',
  sh: 'bash', bash: 'bash',
  html: 'html', css: 'css', scss: 'scss', less: 'less',
  json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml',
  toml: 'toml', ini: 'ini', dockerfile: 'docker',
  md: 'markdown', txt: 'text',
};

/** Get the Prism.js language identifier for syntax highlighting */
export function getPrismLanguage(filename: string): string {
  const ext = getFileExtension(filename);
  return PRISM_LANGUAGE_MAP[ext] || 'text';
}

// ─── Formatting ──────────────────────────────────────────────

/** Format file size to human-readable string */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Format a duration in minutes to human-readable string */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60 > 0 ? `${minutes % 60}m` : ''}`.trim();
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return `${days}d ${hours > 0 ? `${hours}h` : ''}`.trim();
}

/** Calculate time remaining from an ISO date string */
export function getTimeRemaining(expiresAt: string): {
  expired: boolean;
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
} {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { expired: true, totalSeconds: 0, days: 0, hours: 0, minutes: 0, seconds: 0, label: 'Expired' };

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let label: string;
  if (days > 0) label = `${days}d ${hours}h`;
  else if (hours > 0) label = `${hours}h ${minutes}m`;
  else if (minutes > 0) label = `${minutes}m ${seconds}s`;
  else label = `${seconds}s`;

  return { expired: false, totalSeconds, days, hours, minutes, seconds, label };
}

// ─── File Icon Labels ────────────────────────────────────────

const CATEGORY_LABELS: Record<FileCategory, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  pdf: 'PDF',
  code: 'Code',
  document: 'Document',
  presentation: 'Presentation',
  spreadsheet: 'Spreadsheet',
  archive: 'Archive',
  other: 'File',
};

export function getCategoryLabel(category: FileCategory): string {
  return CATEGORY_LABELS[category];
}

// ─── Share Link Generation ───────────────────────────────────

/** Generate a share link with the encryption key in the URL fragment */
export function generateShareLink(
  type: 'drop' | 'text',
  sessionCode: string,
  keyBase64: string
): string {
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  const prefix = type === 'drop' ? 'd' : 't';
  return keyBase64 ? `${baseUrl}/${prefix}/${sessionCode}#${keyBase64}` : `${baseUrl}/${prefix}/${sessionCode}`;
}

/** Extract the encryption key from a URL fragment */
export function extractKeyFromFragment(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  return hash ? hash.substring(1) : null;
}

// ─── Misc ────────────────────────────────────────────────────

/** Generate expiry date from seconds from now */
export function expiryFromSeconds(seconds: number): string {
  const date = new Date();
  date.setSeconds(date.getSeconds() + seconds);
  return date.toISOString();
}

/** Sanitize filename — remove identifying patterns */
export function sanitizeFilename(name: string): string {
  // Return original filename to preserve identity as requested
  return name;
}
