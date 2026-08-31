import { supabase } from './supabase';

export type StorageBucket = 'documents' | 'deliverables' | 'avatars' | 'logos';

export const StorageHelper = {
  /**
   * Generates standard file path: workspaces/{workspaceId}/{folder}/{filename}
   */
  getFilePath(workspaceId: string, folder: string, filename: string): string {
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
    const cleanFilename = filename.replace(/^\/+|\/+$/g, '');
    return `workspaces/${workspaceId}/${cleanFolder}/${cleanFilename}`;
  },

  /**
   * Upload file to Supabase Storage
   */
  async uploadFile(
    bucket: StorageBucket,
    workspaceId: string,
    folder: string,
    file: File
  ): Promise<{ path: string; url: string; error: string | null }> {
    try {
      const path = this.getFilePath(workspaceId, folder, `${Date.now()}_${file.name}`);
      const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

      if (error) {
        return { path: '', url: '', error: error.message };
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      return { path: data.path, url: urlData.publicUrl, error: null };
    } catch (err: any) {
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
   * Get public preview URL or signed download URL
   */
  getPublicUrl(bucket: StorageBucket, path: string): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  /**
   * Get signed URL for private bucket downloads
   */
  async getSignedUrl(bucket: StorageBucket, path: string, expiresIn = 3600): Promise<string> {
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
      if (error || !data) return this.getPublicUrl(bucket, path);
      return data.signedUrl;
    } catch {
      return this.getPublicUrl(bucket, path);
    }
  },
};
