
import { ChunkStore } from './ChunkStore';

export interface ParallelDownloadProgress {
  loaded: number;
  total: number;
  speed?: number; // bytes per second
}

export type ProgressCallback = (p: ParallelDownloadProgress) => void;

export class ParallelDownloader {
  private url: string;
  private store: ChunkStore;
  private chunkSize = 4 * 1024 * 1024; // 4MB
  private concurrency = 4;
  private abortController: AbortController;
  private onProgress?: ProgressCallback;
  private rejecter?: (reason?: unknown) => void;

  constructor(url: string, store: ChunkStore, options?: { chunkSize?: number, concurrency?: number, onProgress?: ProgressCallback }) {
    this.url = url;
    this.store = store;
    this.abortController = new AbortController();
    if (options?.chunkSize) this.chunkSize = options.chunkSize;
    if (options?.concurrency) this.concurrency = options.concurrency;
    this.onProgress = options?.onProgress;
  }

  public async start(): Promise<void> {
    // 1. Get File Info (HEAD)
    const headRes = await fetch(this.url, { method: 'HEAD', signal: this.abortController.signal });
    if (!headRes.ok) {
      throw new Error(`Failed to fetch metadata for ${this.url}: ${headRes.statusText}`);
    }

    const totalBytes = parseInt(headRes.headers.get('Content-Length') || '0', 10);
    const etag = headRes.headers.get('ETag');
    const mimeType = headRes.headers.get('Content-Type') || 'application/octet-stream';

    if (totalBytes === 0) {
      throw new Error(`Invalid content length for ${this.url}`);
    }

    // 2. Initialize Storage
    const meta = await this.store.initFile(this.url, totalBytes, mimeType, etag, this.chunkSize);

    // 3. Determine Missing Chunks
    const missingIndices: number[] = [];
    let loadedBytes = 0;

    for (let i = 0; i < meta.totalChunks; i++) {
      if (!meta.chunks[i]) {
        missingIndices.push(i);
      } else {
        // Calculate loaded bytes based on chunk size
        // Last chunk might be smaller
        const start = i * this.chunkSize;
        const end = Math.min(start + this.chunkSize, totalBytes);
        loadedBytes += (end - start);
      }
    }

    if (missingIndices.length === 0) {
      // Already done
      this.onProgress?.({ loaded: totalBytes, total: totalBytes });
      return;
    }

    // 4. Download Queue
    let activeWorkers = 0;
    let queueIndex = 0;

    return new Promise((resolve, reject) => {
      this.rejecter = reject;
      const processNext = async () => {
        if (this.abortController.signal.aborted) return;

        if (queueIndex >= missingIndices.length) {
          if (activeWorkers === 0) {
            resolve();
          }
          return;
        }

        const chunkIndex = missingIndices[queueIndex++];
        activeWorkers++;

        try {
          await this.downloadChunk(chunkIndex, totalBytes);

          // Update progress
          const start = chunkIndex * this.chunkSize;
          const end = Math.min(start + this.chunkSize, totalBytes);
          loadedBytes += (end - start);
          this.onProgress?.({ loaded: loadedBytes, total: totalBytes });

          activeWorkers--;
          processNext();
        } catch (err) {
          activeWorkers--;
          // If aborted, don't reject, just stop.
          if (this.abortController.signal.aborted) {
            return;
          }
          // Simple retry logic could go here, or just fail fast
          this.abortController.abort(); // Stop other workers
          reject(err);
        }
      };

      // Start initial batch
      const maxWorkers = Math.min(this.concurrency, missingIndices.length);
      for (let i = 0; i < maxWorkers; i++) {
        processNext();
      }
    });
  }

  private async downloadChunk(index: number, totalBytes: number) {
    const start = index * this.chunkSize;
    const end = Math.min(start + this.chunkSize, totalBytes) - 1;

    const response = await fetch(this.url, {
      headers: { 'Range': `bytes=${start}-${end}` },
      signal: this.abortController.signal
    });

    if (!response.ok) {
      throw new Error(`Failed to download chunk ${index}: ${response.statusText}`);
    }

    const blob = await response.blob();
    await this.store.saveChunk(this.url, index, blob);
  }

  public abort() {
    this.abortController.abort();
    if (this.rejecter) {
      this.rejecter(new Error('Download aborted'));
    }
  }
}
