import { supabase, isDemoModeActive } from '@/backend/utilities/supabase';
import { validateUploadFile } from './upload-validator';

export type StorageBucket = 'documents' | 'deliverables' | 'avatars' | 'logos' | 'signatures';

// Private buckets must NEVER be served through public URLs.
const PRIVATE_BUCKETS: ReadonlySet<string> = new Set(['documents', 'deliverables']);

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  // Images (SVG strictly rejected per Task 2d)
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
]);


export interface BuildStoragePathOptions {
  bucket: StorageBucket;
  workspaceId: string;
  clientId?: string | null;
  fileName: string;
}

/**
 * Sanitizes a filename:
 * - Normalizes unicode (NFKC)
 * - Strips directory traversal sequences ('..')
 * - Strips path separators ('/' and '\')
 * - Strips control characters
 * - Limits length (max 80 chars base name, preserving extension)
 * - Retains safe unicode characters (letters, numbers)
 */
export function sanitizeFileName(rawName: string): string {
  if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
    throw new Error('Filename cannot be empty.');
  }

  // 1. Normalize unicode
  let normalized = rawName.normalize('NFKC');

  // 2. Strip control characters (\x00-\x1f and \x7f-\x9f)
  normalized = normalized.replace(/[\u0000-\u001f\u007f-\u009f]/g, '');

  // 3. Extract final path segment if path separators were included
  const segments = normalized.split(/[/\\]+/).filter(Boolean);
  let baseName = segments.length > 0 ? segments[segments.length - 1] : '';

  // 4. Strip directory traversal sequences
  baseName = baseName.replace(/\.{2,}/g, '');

  // 5. Trim leading and trailing periods, spaces, underscores
  baseName = baseName.trim().replace(/^[._\s]+|[._\s]+$/g, '');

  if (!baseName) {
    throw new Error('Filename cannot be empty after sanitization.');
  }

  // 6. Separate base and extension
  const lastDot = baseName.lastIndexOf('.');
  let ext = '';
  let nameOnly = baseName;
  if (lastDot > 0) {
    ext = baseName.slice(lastDot).toLowerCase();
    nameOnly = baseName.slice(0, lastDot);
  }

  // 7. Sanitize extension (only safe alphanumeric chars)
  ext = ext.replace(/[^a-zA-Z0-9.]/g, '');
  if (ext.length > 15) ext = ext.slice(0, 15);

  // 8. Sanitize base name (unicode letters, numbers, dash, underscore, space)
  nameOnly = nameOnly.replace(/[^\p{L}\p{N}_\-\s]/gu, '_').trim();
  if (!nameOnly) {
    nameOnly = 'file';
  }

  // 9. Limit length of base name to 80 characters
  if (nameOnly.length > 80) {
    nameOnly = nameOnly.slice(0, 80).trim();
  }

  const finalName = `${nameOnly}${ext}`;
  if (!finalName || finalName === '.') {
    throw new Error('Filename cannot be empty after sanitization.');
  }

  return finalName;
}

/**
 * Builds canonical storage path:
 * Private buckets (documents, deliverables):
 *   - Client-scoped:   workspaces/<workspaceId>/clients/<clientId>/<prefix>_<fileName>
 *   - Workspace-level: workspaces/<workspaceId>/shared/<prefix>_<fileName>
 * Public buckets (logos, signatures, avatars):
 *   - Branding/public: workspaces/<workspaceId>/branding/<prefix>_<fileName>
 */
export function buildStoragePath(options: BuildStoragePathOptions): string {
  const { bucket, workspaceId, clientId, fileName } = options;

  if (!workspaceId || typeof workspaceId !== 'string' || !UUID_REGEX.test(workspaceId.trim())) {
    throw new Error(`Invalid workspace ID: must be a valid UUID, got "${workspaceId}".`);
  }
  const cleanWsId = workspaceId.trim().toLowerCase();

  let cleanClientId: string | null = null;
  if (clientId !== undefined && clientId !== null && clientId !== '') {
    if (typeof clientId !== 'string' || !UUID_REGEX.test(clientId.trim())) {
      throw new Error(`Invalid client ID: must be a valid UUID, got "${clientId}".`);
    }
    cleanClientId = clientId.trim().toLowerCase();
  }

  const sanitized = sanitizeFileName(fileName);
  const randomPrefix = crypto.randomUUID();

  if (PRIVATE_BUCKETS.has(bucket)) {
    if (cleanClientId) {
      return `workspaces/${cleanWsId}/clients/${cleanClientId}/${randomPrefix}_${sanitized}`;
    }
    return `workspaces/${cleanWsId}/shared/${randomPrefix}_${sanitized}`;
  }

  return `workspaces/${cleanWsId}/branding/${randomPrefix}_${sanitized}`;
}

export const StorageHelper = {
  buildStoragePath,
  sanitizeFileName,

  /**
   * Validates file size, extension, and MIME type before storage operations.
   */
  validateFile(file: File, bucket: StorageBucket = 'documents'): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file provided.' };
    }

    return validateUploadFile(
      {
        name: file.name,
        size: file.size,
        type: file.type,
      },
      bucket
    );
  },

  /**
   * Reads a File object into a base64 Data URL.
   * Only used by the explicitly configured demo environment.
   */
  async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Legacy path generator for backward compatibility.
   * Generates standard file path: workspaces/{workspaceId}/{folder}/{filename}
   */
  getFilePath(workspaceId: string, folder: string, filename: string): string {
    const cleanWorkspaceId = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanFolder = folder.replace(/[^a-zA-Z0-9_/-]/g, '').replace(/^\/+|\/+$/g, '');
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `workspaces/${cleanWorkspaceId}/${cleanFolder}/${cleanFilename}`;
  },

  /**
   * Upload file to Supabase Storage.
   * Production fails closed: a failed upload returns an error — it NEVER
   * falls back to Data-URL/local persistence.
   */
  async uploadFile(
    bucket: StorageBucket,
    workspaceId: string,
    folder: string,
    file: File,
    options?: { clientId?: string | null; customPath?: string }
  ): Promise<{ path: string; url: string; error: string | null }> {
    let bytes: Uint8Array | undefined = undefined;
    if (typeof file.arrayBuffer === 'function') {
      try {
        const buf = await file.arrayBuffer();
        bytes = new Uint8Array(buf);
      } catch {
        // Fallback safely if arrayBuffer unavailable
      }
    }

    const validation = validateUploadFile(
      {
        name: file.name,
        size: file.size,
        type: file.type,
        bytes,
      },
      bucket
    );

    if (!validation.valid) {
      return { path: '', url: '', error: validation.error || 'Invalid file.' };
    }

    // Rate limiting: on server runtime, apply UPLOADS preset rate limit
    if (typeof window === 'undefined') {
      try {
        const { checkRateLimit, RATE_LIMIT_PRESETS } = await import('@/backend/utilities/rate-limiter');
        const rateLimit = await checkRateLimit(workspaceId, RATE_LIMIT_PRESETS.UPLOADS);
        if (!rateLimit.allowed) {
          return {
            path: '',
            url: '',
            error: `Upload rate limit exceeded. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
          };
        }
      } catch {
        // Fall through safely if rate limiter module unavailable in isolation
      }
    }

    // Demo mode: local Data URL previews only in explicitly configured demo environments.
    if (isDemoModeActive()) {
      try {
        const dataUrl = await this.fileToDataUrl(file);
        const path = `local/${workspaceId}/${folder}/${file.name}`;
        return { path, url: dataUrl, error: null };
      } catch (err: any) {
        return { path: '', url: '', error: err?.message || 'File conversion failed' };
      }
    }

    try {
      let path: string;
      if (options?.customPath) {
        path = options.customPath;
      } else if (UUID_REGEX.test(workspaceId)) {
        // Use canonical path when workspaceId is a valid UUID
        path = buildStoragePath({
          bucket,
          workspaceId,
          clientId: options?.clientId,
          fileName: file.name,
        });
      } else {
        path = this.getFilePath(workspaceId, folder, `${Date.now()}_${file.name}`);
      }

      const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: validation.sniffedMime || file.type || 'application/octet-stream',
      });


      if (error) {
        // Production: fail closed — never fabricate a file URL.
        console.error(`[StorageHelper] Upload failed for ${bucket}/${path}:`, error.message);
        return { path: '', url: '', error: error.message || 'File upload failed' };
      }

      const storedPath = data?.path || path;

      if (PRIVATE_BUCKETS.has(bucket)) {
        // Private bucket: return the storage path; consumers must generate a
        // signed URL for download. Never expose a public URL.
        return { path: storedPath, url: '', error: null };
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storedPath);
      return { path: storedPath, url: urlData.publicUrl, error: null };
    } catch (err: any) {
      console.error('[StorageHelper] Unexpected upload error:', err);
      return { path: '', url: '', error: err?.message || 'File upload failed' };
    }
  },

  /**
   * Replace existing file in storage
   */
  async replaceFile(
    bucket: StorageBucket,
    oldPath: string,
    workspaceId: string,
    folder: string,
    newFile: File,
    options?: { clientId?: string | null; customPath?: string }
  ): Promise<{ path: string; url: string; error: string | null }> {
    if (oldPath) {
      await this.deleteFile(bucket, oldPath);
    }
    return this.uploadFile(bucket, workspaceId, folder, newFile, options);
  },

  /**
   * Delete file from storage
   */
  async deleteFile(bucket: StorageBucket, path: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'File deletion failed' };
    }
  },

  /**
   * Public preview URL. Private buckets refuse public URLs — callers must use
   * getSignedUrl() for private content.
   */
  getPublicUrl(bucket: StorageBucket, path: string): string {
    if (!path) return '';
    if (PRIVATE_BUCKETS.has(bucket)) {
      console.error(`[StorageHelper] Refusing public URL for private bucket: ${bucket}`);
      return '';
    }
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  /**
   * Get signed URL for downloads (private and public buckets).
   * Short default expiration of 300 seconds (5 minutes, within 60–300s window).
   * Production fails closed: if signed URL generation fails, an error is thrown —
   * it NEVER falls back to a public URL.
   */
  async getSignedUrl(bucket: StorageBucket, path: string, expiresIn = 300): Promise<string> {
    if (!path) throw new Error('File path is required to generate a download URL.');
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
      if (error || !data?.signedUrl) {
        throw new Error(error?.message || 'Could not generate a signed download URL.');
      }
      return data.signedUrl;
    } catch (err: any) {
      console.error(`[StorageHelper] Signed URL generation failed for ${bucket}/${path}:`, err);
      throw err instanceof Error ? err : new Error('Could not generate a signed download URL.');
    }
  },

  /**
   * Safe download-URL resolver for list mappers: returns a signed URL for
   * private buckets and a public URL for public buckets. Returns '' when the
   * path is empty or signed URL generation fails (never falls back to a public
   * URL for private content).
   * Uses short default expiry of 300 seconds.
   */
  async getDownloadUrl(bucket: StorageBucket, path: string, expiresIn = 300): Promise<string> {
    if (!path) return '';
    if (PRIVATE_BUCKETS.has(bucket)) {
      try {
        return await this.getSignedUrl(bucket, path, expiresIn);
      } catch {
        return '';
      }
    }
    return this.getPublicUrl(bucket, path);
  },
};