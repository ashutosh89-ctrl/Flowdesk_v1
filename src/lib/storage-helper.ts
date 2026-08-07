import { supabase, isSupabaseConfigured } from './supabase';

export interface FileValidationConfig {
  maxSizeMB?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  LOGOS: 'logos',
  DOCUMENTS: 'documents',
  DELIVERABLES: 'deliverables',
  RECEIPTS: 'receipts',
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export const DEFAULT_FILE_LIMITS: Record<StorageBucket, FileValidationConfig> = {
  avatars: {
    maxSizeMB: 5,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
  },
  logos: {
    maxSizeMB: 5,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'svg', 'webp'],
  },
  documents: {
    maxSizeMB: 25,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'text/plain',
    ],
    allowedExtensions: ['pdf', 'doc', 'docx', 'jpg', 'png', 'txt'],
  },
  deliverables: {
    maxSizeMB: 50,
    allowedMimeTypes: [
      'application/pdf',
      'application/zip',
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
    ],
    allowedExtensions: ['pdf', 'zip', 'jpg', 'png', 'webp', 'mp4', 'fig'],
  },
  receipts: {
    maxSizeMB: 10,
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
  },
};

/**
 * Validates file size, extension, and mime type before upload
 */
export function validateFileUpload(
  file: File,
  bucket: StorageBucket
): { valid: boolean; error?: string } {
  const config = DEFAULT_FILE_LIMITS[bucket];
  if (!config) return { valid: true };

  // 1. Size Check
  if (config.maxSizeMB) {
    const maxSizeBytes = config.maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `File size exceeds maximum limit of ${config.maxSizeMB}MB.`,
      };
    }
  }

  // 2. Extension Check
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (config.allowedExtensions && ext) {
    if (!config.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `File format .${ext} is not allowed for ${bucket}. Allowed: ${config.allowedExtensions.join(', ')}.`,
      };
    }
  }

  // 3. Mime Type Check
  if (config.allowedMimeTypes && file.type) {
    if (!config.allowedMimeTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File MIME type ${file.type} is not supported.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Generates secure, sanitized path structure: `userId/timestamp-sanitizedFilename`
 */
export function generateStoragePath(userId: string, fileName: string): string {
  const sanitizedName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '_')
    .replace(/_+/g, '_');
  const timestamp = Date.now();
  return `${userId}/${timestamp}_${sanitizedName}`;
}

export const StorageService = {
  /**
   * Upload file to Supabase Storage with validation
   */
  async uploadFile(
    bucket: StorageBucket,
    userId: string,
    file: File
  ): Promise<{ url: string; path: string; error: string | null }> {
    const validation = validateFileUpload(file, bucket);
    if (!validation.valid) {
      return { url: '', path: '', error: validation.error || 'Validation failed.' };
    }

    const path = generateStoragePath(userId, file.name);

    if (!isSupabaseConfigured) {
      // Mock/Local Storage URL fallback
      const mockUrl = URL.createObjectURL(file);
      return { url: mockUrl, path, error: null };
    }

    try {
      const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

      if (error) {
        return { url: '', path: '', error: error.message };
      }

      // Public or Signed URL retrieval
      if (bucket === STORAGE_BUCKETS.AVATARS || bucket === STORAGE_BUCKETS.LOGOS) {
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
        return { url: publicData.publicUrl, path: data.path, error: null };
      } else {
        const { data: signedData, error: signErr } = await supabase.storage
          .from(bucket)
          .createSignedUrl(data.path, 60 * 60 * 24); // 24 hours valid
        return {
          url: signedData?.signedUrl || '',
          path: data.path,
          error: signErr?.message || null,
        };
      }
    } catch (err: any) {
      return { url: '', path: '', error: err.message || 'Storage upload error.' };
    }
  },

  /**
   * Delete file from bucket
   */
  async deleteFile(bucket: StorageBucket, path: string): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { success: true, error: null };
    }

    try {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Storage deletion error.' };
    }
  },

  /**
   * Get temporary signed URL for private bucket files
   */
  async getSignedUrl(bucket: StorageBucket, path: string): Promise<string | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60); // 1 hour
      if (error) return null;
      return data.signedUrl;
    } catch {
      return null;
    }
  },
};
