import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DownloadDB extends DBSchema {
  downloads: {
    key: string; // URL
    value: {
      url: string;
      totalBytes: number;
      chunkCount: number;
      etag: string | null;
      lastModified: number;
    };
  };
  chunks: {
    key: [string, number]; // [URL, index]
    value: Blob;
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

        const db = await openDB<DownloadDB>('texpen-downloads', 2, {
          upgrade(db, oldVersion, newVersion, transaction) {
            // If migrating from v1 or older, we need to clear everything because the schema is incompatible
            if (oldVersion < 2) {
              if (db.objectStoreNames.contains('downloads')) {
                db.deleteObjectStore('downloads');
              }
              // Create new stores
              db.createObjectStore('downloads', { keyPath: 'url' });
              db.createObjectStore('chunks', { keyPath: ['url', 'index'] }); // Compound key
            }
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

export async function saveChunk(url: string, chunk: Blob, totalBytes: number, chunkIndex: number, etag: string | null) {
  const db = await getDB();
  if (!db) {
    throw new Error('IndexedDB is unavailable');
  }

  const tx = db.transaction(['downloads', 'chunks'], 'readwrite');
  const metadataStore = tx.objectStore('downloads');
  const chunkStore = tx.objectStore('chunks');

  // 1. Get existing metadata
  let entry = await metadataStore.get(url);

  // 2. Check for ETag mismatch (server file changed)
  if (entry && etag && entry.etag && entry.etag !== etag) {
    entry = undefined; // Treat as new
  }

  if (!entry) {
    entry = {
      url,
      totalBytes,
      chunkCount: 0,
      etag,
      lastModified: Date.now(),
    };
  }

  // 3. Save Chunk
  await chunkStore.put(chunk, [url, chunkIndex]);

  // 4. Update Metadata
  entry.chunkCount = Math.max(entry.chunkCount, chunkIndex + 1);
  entry.lastModified = Date.now();
  entry.totalBytes = totalBytes; // Ensure total is set
  entry.etag = etag;

  await metadataStore.put(entry);
  await tx.done;
}

export async function getChunk(url: string, index: number): Promise<Blob | undefined> {
  const db = await getDB();
  if (!db) return undefined;
  return db.get('chunks', [url, index]);
}

export async function getPartialDownload(url: string) {
  const db = await getDB();
  if (!db) return null;
  return db.get('downloads', url);
}

export async function clearPartialDownload(url: string) {
  const db = await getDB();
  if (!db) return;

  const tx = db.transaction(['downloads', 'chunks'], 'readwrite');
  const metadataStore = tx.objectStore('downloads');
  const chunkStore = tx.objectStore('chunks');

  // 1. Get metadata to know how many chunks to delete
  const entry = await metadataStore.get(url);
  if (entry) {
    // We don't have a range delete for compound keys easily without a range query
    // But we know chunkCount.
    const promises = [];
    for (let i = 0; i < entry.chunkCount; i++) {
      promises.push(chunkStore.delete([url, i]));
    }
    await Promise.all(promises);

    // Delete metadata
    await metadataStore.delete(url);
  } else {
    // If no metadata but maybe orphaned chunks? Hard to know without key cursor.
    // For now assuming metadata is source of truth.
    // But let's try to be safe.
    // In v2 we can't easily iterate all chunks for a URL without an index on 'url'.
    // But we didn't add an index on 'url' for chunks store!
    // We used keyPath: ['url', 'index'].
    // IDB KeyRange on [url, 0] to [url, Infinity] works!
    const range = IDBKeyRange.bound([url, 0], [url, Infinity]);
    let cursor = await chunkStore.openCursor(range);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }

  await tx.done;
}
