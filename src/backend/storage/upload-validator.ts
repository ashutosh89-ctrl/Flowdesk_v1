import {
  StorageBucket,
  BUCKET_UPLOAD_RULES,
  BLOCKED_EXTENSIONS,
  BLOCKED_MIME_TYPES,
} from '@/shared/config/upload-config';
import { sanitizeFileName } from './storage-helper';

export interface FileValidationInput {
  name: string;
  size: number;
  type?: string;
  bytes?: Uint8Array | Buffer;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sniffedMime?: string;
  sanitizedName?: string;
}

/**
 * Sniffs the authoritative MIME type of a file buffer using magic byte signatures.
 */
export function sniffMimeType(bytes: Uint8Array | Buffer): string | null {
  if (!bytes || bytes.length < 4) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }

  // WebP: RIFF .... WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // PDF: %PDF (25 50 44 46)
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // ZIP (also docx/xlsx): PK.. (50 4B 03 04, 05 06, or 07 08)
  if (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
  ) {
    return 'application/zip';
  }

  return null;
}

/**
 * Validates a file on the server side prior to Supabase storage operations.
 * Enforces per-bucket size limits, allow-lists, magic byte verification,
 * double-extension rejection, null-byte prevention, and executable block-lists.
 */
export function validateUploadFile(
  file: FileValidationInput,
  bucket: StorageBucket
): FileValidationResult {
  const bucketRule = BUCKET_UPLOAD_RULES[bucket];
  if (!bucketRule) {
    return { valid: false, error: `Invalid or unrecognized storage bucket: ${bucket}` };
  }

  // 1. Check for missing or empty file
  if (!file || typeof file.name !== 'string') {
    return { valid: false, error: 'No file provided.' };
  }

  // 2. Check null bytes in filename
  if (file.name.includes('\0') || file.name.includes('%00')) {
    return { valid: false, error: 'Filename contains forbidden null byte characters.' };
  }

  const rawName = file.name.trim();
  if (!rawName) {
    return { valid: false, error: 'Filename cannot be empty.' };
  }

  // 3. File size verification
  if (file.size <= 0) {
    return { valid: false, error: 'File is empty (0 bytes).' };
  }

  if (file.size > bucketRule.maxSizeBytes) {
    const maxMb = (bucketRule.maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size exceeds the allowable limit of ${maxMb}MB for ${bucket}.`,
    };
  }

  // 4. Extension extraction and double-extension analysis
  const parts = rawName.split('.').filter(Boolean);
  if (parts.length < 2) {
    return { valid: false, error: 'File must have a valid file extension.' };
  }

  const finalExt = parts[parts.length - 1].toLowerCase();

  // Check ALL segments for dangerous/executable extensions (e.g. invoice.pdf.exe or file.exe.pdf)
  for (let i = 1; i < parts.length; i++) {
    const ext = parts[i].toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: `File rejected: extension ".${ext}" is blocked for security reasons.`,
      };
    }
  }

  // Verify final extension against bucket allow-list
  if (!bucketRule.allowedExtensions.includes(finalExt)) {
    return {
      valid: false,
      error: `Extension ".${finalExt}" is not permitted for bucket "${bucket}". Allowed: ${bucketRule.allowedExtensions.join(', ')}`,
    };
  }

  // 5. Blocked MIME type check
  if (file.type && BLOCKED_MIME_TYPES.has(file.type.toLowerCase())) {
    return {
      valid: false,
      error: `MIME type "${file.type}" is strictly blocked.`,
    };
  }

  // 6. Magic byte sniffing if binary bytes are available
  let sniffedMime: string | undefined = undefined;
  if (file.bytes && file.bytes.length > 0) {
    const detected = sniffMimeType(file.bytes);

    // Enforce magic-byte match for images and PDFs
    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const isImageExt = imageExtensions.includes(finalExt);
    const isPdfExt = finalExt === 'pdf';

    if (isImageExt) {
      if (!detected || !detected.startsWith('image/')) {
        return {
          valid: false,
          error: `File signature mismatch: expected image bytes for ".${finalExt}", but file contents do not match image format.`,
        };
      }
      // Specific format cross-check
      if ((finalExt === 'jpg' || finalExt === 'jpeg') && detected !== 'image/jpeg') {
        return { valid: false, error: 'File signature mismatch: expected JPEG header.' };
      }
      if (finalExt === 'png' && detected !== 'image/png') {
        return { valid: false, error: 'File signature mismatch: expected PNG header.' };
      }
      if (finalExt === 'gif' && detected !== 'image/gif') {
        return { valid: false, error: 'File signature mismatch: expected GIF header.' };
      }
      if (finalExt === 'webp' && detected !== 'image/webp') {
        return { valid: false, error: 'File signature mismatch: expected WebP header.' };
      }
      sniffedMime = detected;
    } else if (isPdfExt) {
      if (detected !== 'application/pdf') {
        return {
          valid: false,
          error: 'File signature mismatch: expected PDF header (%PDF).',
        };
      }
      sniffedMime = 'application/pdf';
    } else {
      sniffedMime = detected || file.type || 'application/octet-stream';
    }
  } else {
    // If bytes not provided, fallback to client-provided type or bucket rule
    sniffedMime = file.type || 'application/octet-stream';
  }

  // 7. Sanitize filename using existing canonical helper
  let sanitizedName: string;
  try {
    sanitizedName = sanitizeFileName(rawName);
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Invalid filename.' };
  }

  return {
    valid: true,
    sniffedMime,
    sanitizedName,
  };
}
