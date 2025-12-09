import { openDB, DBSchema } from 'idb';

interface DownloadDB extends DBSchema {
  partial_downloads: {
    key: string;
    value: {
      url: string;
      contentLength: number;
      chunks: Blob[];
      downloadedBytes: number;
      lastUpdated: number;
      etag?: string;
    };
  };
}

const DB_NAME = 'texpen-downloads';
const DB_VERSION = 1;

export async function getDB() {
  return openDB<DownloadDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('partial_downloads')) {
        db.createObjectStore('partial_downloads', { keyPath: 'url' });
      }
    },
  });
}

export async function saveChunk(url: string, chunk: Blob, totalSize: number, etag?: string) {
  const db = await getDB();
  const tx = db.transaction('partial_downloads', 'readwrite');
  const store = tx.objectStore('partial_downloads');

  let record = await store.get(url);

  if (!record || record.etag !== etag) {
    // New download or changed file on server (etag mismatch)
    record = {
      url,
      contentLength: totalSize,
      chunks: [chunk],
      downloadedBytes: chunk.size,
      lastUpdated: Date.now(),
      etag
    };
  } else {
    // Append
    record.chunks.push(chunk);
    record.downloadedBytes += chunk.size;
    record.lastUpdated = Date.now();
  }

  await store.put(record);
  await tx.done;
}

export async function getPartialDownload(url: string) {
  const db = await getDB();
  return db.get('partial_downloads', url);
}

export async function clearPartialDownload(url: string) {
  const db = await getDB();
  return db.delete('partial_downloads', url);
}
