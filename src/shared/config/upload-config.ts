export type StorageBucket = 'documents' | 'deliverables' | 'avatars' | 'logos' | 'signatures';

export interface BucketUploadRule {
  maxSizeBytes: number;
  allowedMimeTypes: readonly string[];
  allowedExtensions: readonly string[];
  description: string;
}

// Workspace global quotas
export const MAX_FILES_PER_WORKSPACE = 1000;
export const MAX_TOTAL_STORAGE_BYTES_PER_WORKSPACE = 1024 * 1024 * 1024; // 1 GB

// Absolute blocklist for dangerous executable, script, and web vectors
export const BLOCKED_EXTENSIONS: ReadonlySet<string> = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bash', 'ps1', 'vbs', 'js', 'mjs', 'cjs',
  'ts', 'jsx', 'tsx', 'html', 'htm', 'xhtml', 'svg', 'php', 'phtml',
  'py', 'rb', 'jar', 'apk', 'msi', 'com', 'scr', 'dll', 'reg', 'vbe',
  'wsf', 'wsh', 'hta', 'cpl', 'msp', 'action', 'bin', 'command'
]);

export const BLOCKED_MIME_TYPES: ReadonlySet<string> = new Set([
  'text/html',
  'image/svg+xml',
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
  'application/x-sh',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'text/x-python',
  'text/x-php',
  'application/x-php',
  'application/x-httpd-php',
]);

const SAFE_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

const SAFE_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const;

const SAFE_DOCUMENT_MIMES = [
  ...SAFE_IMAGE_MIMES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
] as const;

const SAFE_DOCUMENT_EXTENSIONS = [
  ...SAFE_IMAGE_EXTENSIONS,
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'txt',
  'csv',
  'zip',
] as const;

export const BUCKET_UPLOAD_RULES: Record<StorageBucket, BucketUploadRule> = {
  avatars: {
    maxSizeBytes: 2 * 1024 * 1024, // 2 MB
    allowedMimeTypes: SAFE_IMAGE_MIMES,
    allowedExtensions: SAFE_IMAGE_EXTENSIONS,
    description: 'Avatar images (JPEG, PNG, WebP, GIF up to 2MB)',
  },
  logos: {
    maxSizeBytes: 2 * 1024 * 1024, // 2 MB
    allowedMimeTypes: SAFE_IMAGE_MIMES,
    allowedExtensions: SAFE_IMAGE_EXTENSIONS,
    description: 'Studio & client logos (JPEG, PNG, WebP, GIF up to 2MB - SVG disabled for security)',
  },
  signatures: {
    maxSizeBytes: 2 * 1024 * 1024, // 2 MB
    allowedMimeTypes: SAFE_IMAGE_MIMES,
    allowedExtensions: SAFE_IMAGE_EXTENSIONS,
    description: 'Signatures (JPEG, PNG, WebP up to 2MB - SVG disabled for security)',
  },
  documents: {
    maxSizeBytes: 25 * 1024 * 1024, // 25 MB
    allowedMimeTypes: SAFE_DOCUMENT_MIMES,
    allowedExtensions: SAFE_DOCUMENT_EXTENSIONS,
    description: 'Workspace documents & assets (PDF, DOCX, XLSX, TXT, CSV, ZIP, images up to 25MB)',
  },
  deliverables: {
    maxSizeBytes: 25 * 1024 * 1024, // 25 MB
    allowedMimeTypes: SAFE_DOCUMENT_MIMES,
    allowedExtensions: SAFE_DOCUMENT_EXTENSIONS,
    description: 'Project deliverables & revisions (PDF, DOCX, XLSX, TXT, CSV, ZIP, images up to 25MB)',
  },
};
