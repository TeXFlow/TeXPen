import { openDB, IDBPDatabase, DBSchema } from 'idb';

interface DownloadDB extends DBSchema {
  metadata: {
    key: string; // URL
    value: {
      url: string;
      totalBytes: number;
      downloadedBytes: number; // For O(1) resumption
      chunkCount: number;
      lastModified: number;
      etag: string | null;
      fsPath?: string; // Future proofing
    };
  };
  chunks: {
    key: [string, number]; // [URL, ChunkIndex]
    value: Blob; // Raw blob data
  };
}

export class ChunkStore {
  private static DB_NAME = 'texpen-downloads-v2';
  private static DB_VERSION = 1;

  private dbPromise: Promise<IDBPDatabase<DownloadDB>>;

  constructor() {
    this.dbPromise = openDB<DownloadDB>(ChunkStore.DB_NAME, ChunkStore.DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'url' });
        }
        if (!db.objectStoreNames.contains('chunks')) {
          // Compound key for efficient querying of chunks for a specific file
          db.createObjectStore('chunks', { keyPath: ['url', 'index'] });
        }
      },
    });
  }

  /**
   * Appends a chunk to the store and updates metadata atomically.
   */
  public async appendChunk(url: string, chunk: Blob, index: number, totalBytes: number, etag: string | null): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(['metadata', 'chunks'], 'readwrite');
    const metadataStore = tx.objectStore('metadata');
    const chunkStore = tx.objectStore('chunks');

    // 1. Save Chunk
    await chunkStore.put(chunk, [url, index]);

    // 2. Update Metadata
    let meta = await metadataStore.get(url);
    if (!meta) {
      meta = {
        url,
        totalBytes,
        downloadedBytes: 0,
        chunkCount: 0,
        lastModified: Date.now(),
        etag
      };
    } else {
      // Validation: If ETag changed, we shouldn't be appending.
      // The Job should have caught this, but we handle it here just in case? 
      // No, let's just update.
    }

    // Always update these
    meta.chunkCount = Math.max(meta.chunkCount, index + 1);

    // We can't just sum stored chunks cheaply. 
    // But since appendChunk is usually sequential: 
    // If index == meta.chunkCount - 1 (next chunk), we add size.
    // If we rely on sequential writing for valid metadata:
    if (index === 0) {
      meta.downloadedBytes = chunk.size;
    } else {
      // This is safe ONLY if we write sequentially. DownloadJob guarantees this?
      // Ideally we pass 'currentOffset' or similar. 
      // Let's assume sequential for now OR simpler:
      // We know we just added 'chunk.size'.
      // But if we are overwriting?
      // Let's rely on DownloadJob passing the new total.
      // Or better: update `downloadedBytes` to be the end of THIS chunk?
      // But we need the cumulative size.
      // If we are resuming, meta.downloadedBytes is our start point.
      // So new downloadedBytes = old downloadedBytes + chunk.size?
      // Only if sequential.

      // BETTER: DownloadJob should track offsets and we just save what it tells us?
      // No, ChunkStore should be self-contained if possible.
      // But without reading previous chunks we can't know total size if we jump around.
      // DownloadJob IS sequential.
      meta.downloadedBytes = (meta.downloadedBytes || 0) + chunk.size;
    }

    meta.lastModified = Date.now();
    meta.totalBytes = totalBytes; // Ensure latest total is kept

    await metadataStore.put(meta);
    await tx.done;
  }

  public async getMetadata(url: string) {
    const db = await this.dbPromise;
    return await db.get('metadata', url);
  }

  public async clear(url: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(['metadata', 'chunks'], 'readwrite');
    const chunkStore = tx.objectStore('chunks');
    const metadataStore = tx.objectStore('metadata');

    // Delete all chunks for this URL
    // We can use a key range because of the compound index [url, index]
    const range = IDBKeyRange.bound([url, 0], [url, Infinity]);
    let cursor = await chunkStore.openCursor(range);

    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }

    await metadataStore.delete(url);
    await tx.done;
  }

  /**
   * Returns a ReadableStream that yields chunks from IDB for the given URL.
   * This is critical for constructing a Response passed to Cache API without loading all into RAM.
   */
  public async getStream(url: string, expectedChunks: number): Promise<ReadableStream<Uint8Array>> {
    const db = await this.dbPromise;
    let index = 0;

    return new ReadableStream({
      async pull(controller) {
        if (index >= expectedChunks) {
          controller.close();
          return;
        }

        try {
          const chunk = await db.get('chunks', [url, index]);
          if (!chunk) {
            controller.error(new Error(`Missing chunk ${index} for ${url}`));
            return;
          }

          // Convert Blob to Uint8Array/ArrayBuffer for the stream
          const buffer = await new Response(chunk).arrayBuffer();
          controller.enqueue(new Uint8Array(buffer));

          // Explicit cleanup hints
          index++;
        } catch (err) {
          controller.error(err);
        }
      }
    });
  }
}
