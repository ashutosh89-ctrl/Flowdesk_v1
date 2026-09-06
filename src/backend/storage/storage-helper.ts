import { supabase, isDemoModeActive } from '@/backend/utilities/supabase';

export type StorageBucket = 'documents' | 'deliverables' | 'avatars' | 'logos' | 'signatures';

// Private buckets must NEVER be served through public URLs.
const PRIVATE_BUCKETS: ReadonlySet<string> = new Set(['documents', 'deliverables']);

export const StorageHelper = {
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
   * Generates standard file path: workspaces/{workspaceId}/{folder}/{filename}
   */
  getFilePath(workspaceId: string, folder: string, filename: string): string {
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
    const cleanFilename = filename.replace(/^\/+|\/+$/g, '');
    return `workspaces/${workspaceId}/${cleanFolder}/${cleanFilename}`;
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
    file: File
  ): Promise<{ path: string; url: string; error: string | null }> {
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
      const path = this.getFilePath(workspaceId, folder, `${Date.now()}_${file.name}`);
      const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
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
    newFile: File
  ): Promise<{ path: string; url: string; error: string | null }> {
    if (oldPath) {
      await this.deleteFile(bucket, oldPath);
    }
    return this.uploadFile(bucket, workspaceId, folder, newFile);
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
   * Production fails closed: if signed URL generation fails, an error is thrown —
   * it NEVER falls back to a public URL.
   */
  async getSignedUrl(bucket: StorageBucket, path: string, expiresIn = 3600): Promise<string> {
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
   */
  async getDownloadUrl(bucket: StorageBucket, path: string, expiresIn = 3600): Promise<string> {
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