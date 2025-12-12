import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DownloadDB extends DBSchema {
  downloads: {
    key: string; // URL
    value: {
      url: string;
      chunks: Blob[];
      totalBytes: number;
      etag: string | null;
      lastModified: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<DownloadDB> | null> | null = null;
let dbUnavailableLogged = false;

/**
 * Gets the IndexedDB database instance.
 * Returns null if IndexedDB is unavailable (e.g., mobile Safari private mode, iOS 14 and below in some cases).
 */
export async function getDB(): Promise<IDBPDatabase<DownloadDB> | null> {
  if (dbPromise === null) {
    dbPromise = (async () => {
      try {
        // Check if IndexedDB is available at all
        if (typeof indexedDB === 'undefined') {
          if (!dbUnavailableLogged) {
            console.warn('[db] IndexedDB is not available in this browser.');
            dbUnavailableLogged = true;
          }
          return null;
        }

        const db = await openDB<DownloadDB>('texpen-downloads', 1, {
          upgrade(db) {
            db.createObjectStore('downloads', { keyPath: 'url' });
          },
        });
        return db;
      } catch (error) {
        // IndexedDB can throw in private browsing mode on some mobile browsers
        if (!dbUnavailableLogged) {
          console.warn('[db] Failed to open IndexedDB (likely private browsing mode):', error);
          dbUnavailableLogged = true;
        }
        return null;
      }
    })();
  }
  return dbPromise;
}

export async function saveChunk(url: string, chunk: Blob, totalBytes: number, _chunkIndex: number, etag: string | null) {
  const db = await getDB();
  if (!db) {
    // IndexedDB is unavailable - throw to trigger memory-only fallback in DownloadManager
    throw new Error('IndexedDB is unavailable');
  }

  const tx = db.transaction('downloads', 'readwrite');
  const store = tx.objectStore('downloads');

  let entry = await store.get(url);
  if (!entry) {
    entry = {
      url,
      chunks: [],
      totalBytes,
      etag,
      lastModified: Date.now(),
    };
  }

  // Verify ETag if resuming
  if (etag && entry.etag && entry.etag !== etag) {
    // ETag mismatch - server file changed. Restart.
    // In a real app we might throw or handle this gracefully.
    // For now, clear and restart.
    await store.delete(url);
    entry = {
      url,
      chunks: [],
      totalBytes,
      etag,
      lastModified: Date.now(),
    };
  }

  entry.chunks.push(chunk);
  entry.lastModified = Date.now();

  await store.put(entry);
  await tx.done;
}

export async function getPartialDownload(url: string) {
  const db = await getDB();
  if (!db) {
    // IndexedDB unavailable - no partial download possible
    return null;
  }
  return db.get('downloads', url);
}

export async function clearPartialDownload(url: string) {
  const db = await getDB();
  if (!db) {
    // IndexedDB unavailable - nothing to clear
    return;
  }
  return db.delete('downloads', url);
}

