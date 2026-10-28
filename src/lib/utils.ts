// Phantom - Shared Utilities

// ─── File Categories ─────────────────────────────────────────

export type FileCategory = 'image' | 'video' | 'audio' | 'pdf' | 'code' | 'document' | 'archive' | 'presentation' | 'spreadsheet' | 'other';

const FILE_CATEGORIES: Record<string, FileCategory> = {
  // Images
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', ico: 'image', avif: 'image', tiff: 'image', tif: 'image', heic: 'image',
  // Video
  mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video', m4v: 'video', ogv: 'video', '3gp': 'video',
  // Audio
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio', aac: 'audio', wma: 'audio', opus: 'audio', aiff: 'audio',
  // PDF
  pdf: 'pdf',
  // Spreadsheets
  xls: 'spreadsheet', xlsx: 'spreadsheet', csv: 'spreadsheet', tsv: 'spreadsheet', ods: 'spreadsheet',
  // Documents & Office
  doc: 'document', docx: 'document', rtf: 'document', odt: 'document', txt: 'document', md: 'document', markdown: 'document', log: 'document', text: 'document', diff: 'document', patch: 'document',
  // Presentations
  ppt: 'presentation', pptx: 'presentation', key: 'presentation', odp: 'presentation',
  // Archives
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive', bz2: 'archive', xz: 'archive',
  // Code & Developer Files
  js: 'code', jsx: 'code', ts: 'code', tsx: 'code', mjs: 'code', cjs: 'code',
  py: 'code', pyw: 'code', java: 'code', c: 'code', cpp: 'code', cc: 'code', cxx: 'code',
  h: 'code', hpp: 'code', cs: 'code', go: 'code', rs: 'code', rb: 'code', php: 'code',
  swift: 'code', kt: 'code', kts: 'code', scala: 'code', r: 'code', sql: 'code', sh: 'code', bash: 'code', zsh: 'code',
  html: 'code', htm: 'code', css: 'code', scss: 'code', sass: 'code', less: 'code',
  json: 'code', jsonc: 'code', xml: 'code', yaml: 'code', yml: 'code',
  toml: 'code', ini: 'code', cfg: 'code', conf: 'code', env: 'code', gitignore: 'code', gitattributes: 'code',
  dockerfile: 'code', makefile: 'code', cmake: 'code', gradle: 'code',
  lua: 'code', dart: 'code', perl: 'code', pl: 'code', graphql: 'code', gql: 'code',
  svelte: 'code', vue: 'code', astro: 'code',
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
  return ['image', 'video', 'audio', 'pdf', 'code', 'document', 'spreadsheet', 'presentation', 'archive'].includes(category);
}

// ─── Prism.js Language Mapping ───────────────────────────────

const PRISM_LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx', mjs: 'javascript', cjs: 'javascript',
  py: 'python', pyw: 'python', java: 'java', c: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
  h: 'c', hpp: 'cpp', cs: 'csharp',
  go: 'go', rs: 'rust', rb: 'ruby', php: 'php', swift: 'swift',
  kt: 'kotlin', kts: 'kotlin', scala: 'scala', r: 'r', sql: 'sql',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  html: 'html', htm: 'html', css: 'css', scss: 'scss', sass: 'scss', less: 'less',
  json: 'json', jsonc: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml',
  toml: 'toml', ini: 'ini', cfg: 'ini', conf: 'ini', env: 'bash',
  dockerfile: 'docker', makefile: 'makefile',
  md: 'markdown', markdown: 'markdown', txt: 'text', text: 'text',
  diff: 'diff', patch: 'diff',
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

/** Sanitize filename - remove dangerous path separators, null bytes, and control characters */
export function sanitizeFilename(name: string): string {
  if (!name) return 'downloaded_file';
  // Strip null bytes, control characters, and path traversal sequences
  const sanitized = name
    .replace(/\0/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/^[./\\]+/, '')
    .replace(/[/\\]/g, '_')
    .trim();
  return sanitized || 'downloaded_file';
}
