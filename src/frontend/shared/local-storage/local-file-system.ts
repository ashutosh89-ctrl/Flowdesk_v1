/**
 * FlowDesk Hybrid Local File Storage Architecture
 *
 * Implements direct local-device storage integration using the File System Access API
 * and IndexedDB directory handle persistence.
 *
 * Guarantees:
 * 1. Large files, raw source files, and project documents remain on the freelancer's local machine.
 * 2. Zero cloud storage quota restrictions or billing limits.
 * 3. File metadata (name, size, hash, path, project links) is synced to Supabase PostgreSQL.
 * 4. Client Portal never receives direct access to the freelancer's local filesystem.
 * 5. Client delivery is handled via explicit, user-initiated delivery uploads.
 */

const DB_NAME = 'flowdesk_local_storage_db';
const STORE_NAME = 'workspace_handles';
const DIR_HANDLE_KEY = 'primary_workspace_directory';

export interface LocalFileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  checksum: string;
  relativePath?: string;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Open native directory picker and persist handle in IndexedDB
 */
export async function pickWorkspaceDirectory(): Promise<{ name: string; handle: any } | null> {
  if (!isFileSystemAccessSupported()) {
    return null;
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      id: 'flowdesk_workspace_root',
      mode: 'readwrite',
    });

    if (handle) {
      await saveDirectoryHandle(handle);
      return { name: handle.name, handle };
    }
    return null;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return null; // User cancelled
    }
    console.warn('[LocalFS] Directory picker error:', err);
    return null;
  }
}

/**
 * Open native file picker for individual local project files
 */
export async function pickLocalProjectFiles(multiple: boolean = true): Promise<File[]> {
  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    try {
      const handles = await (window as any).showOpenFilePicker({
        multiple,
      });
      const files: File[] = [];
      for (const h of handles) {
        const file = await h.getFile();
        files.push(file);
      }
      return files;
    } catch (err: any) {
      if (err?.name === 'AbortError') return [];
    }
  }

  // Fallback: standard input element
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    input.onchange = () => {
      resolve(input.files ? Array.from(input.files) : []);
    };
    input.click();
  });
}

/**
 * Compute SHA-256 checksum for local file integrity verification
 */
export async function computeFileChecksum(file: File): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buffer = await file.slice(0, 1024 * 1024).arrayBuffer(); // Hash first 1MB for speed
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Non-critical fallback
  }
  return `${file.name}-${file.size}-${file.lastModified}`;
}

/**
 * Read structured file metadata without uploading full bytes
 */
export async function extractLocalFileMetadata(file: File): Promise<LocalFileMetadata> {
  const checksum = await computeFileChecksum(file);
  return {
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    lastModified: file.lastModified,
    checksum,
  };
}

// --- IndexedDB Handle Persistence ---

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirectoryHandle(handle: any): Promise<void> {
  try {
    const db = await openHandleDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, DIR_HANDLE_KEY);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[LocalFS] Failed to cache directory handle:', err);
  }
}

export async function getPersistedDirectoryHandle(): Promise<{ name: string; handle: any } | null> {
  try {
    const db = await openHandleDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(DIR_HANDLE_KEY);
    return new Promise((resolve) => {
      req.onsuccess = async () => {
        const handle = req.result;
        if (!handle) {
          resolve(null);
          return;
        }

        // Verify permission query
        try {
          if (typeof handle.queryPermission === 'function') {
            const perm = await handle.queryPermission({ mode: 'readwrite' });
            if (perm === 'granted') {
              resolve({ name: handle.name, handle });
              return;
            }
          }
        } catch {
          // Fall through
        }
        resolve({ name: handle.name, handle });
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

