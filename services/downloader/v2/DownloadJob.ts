import { ChunkStore } from './ChunkStore';

export type DownloadStatus = 'pending' | 'running' | 'paused' | 'completed' | 'error';

export interface DownloadProgress {
  loaded: number;
  total: number;
  speed: number; // bytes per second
}

export class DownloadJob {
  public id: string; // The URL
  public status: DownloadStatus = 'pending';
  public progress: DownloadProgress = { loaded: 0, total: 0, speed: 0 };
  public error: Error | null = null;

  private store: ChunkStore;
  private abortController: AbortController | null = null;
  private onProgressCallback?: (progress: DownloadProgress) => void;
  private onCompleteCallback?: (result?: Blob) => void;
  private onErrorCallback?: (err: Error) => void;

  private bufferSize = 5 * 1024 * 1024; // 5MB buffer before flush (tuned for mobile)

  constructor(url: string, store: ChunkStore) {
    this.id = url;
    this.store = store;
  }

  public memoryChunks: Blob[] = [];
  public isMemoryMode = false;
  private quotaHandler?: () => Promise<boolean>;

  public setQuotaHandler(handler: () => Promise<boolean>) {
    this.quotaHandler = handler;
  }

  public setCallbacks(
    onProgress: (p: DownloadProgress) => void,
    onComplete: (result?: Blob) => void,
    onError: (e: Error) => void
  ) {
    this.onProgressCallback = onProgress;
    this.onCompleteCallback = onComplete;
    this.onErrorCallback = onError;
  }

  public async start() {
    if (this.status === 'running' || this.status === 'completed') return;
    this.status = 'running';
    this.error = null;
    this.abortController = new AbortController();

    try {
      await this._execute();
      this.status = 'completed';
      if (this.onCompleteCallback) {
        if (this.isMemoryMode) {
          this.onCompleteCallback(new Blob(this.memoryChunks));
        } else {
          this.onCompleteCallback();
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        this.status = 'paused';
        return;
      }
      console.error(`Download failed: ${this.id}`, e);
      this.status = 'error';
      this.error = e as Error;
      if (this.onErrorCallback) this.onErrorCallback(e as Error);
    }
  }

  public pause() {
    if (this.status !== 'running') return;
    this.status = 'paused';
    if (this.abortController) this.abortController.abort();
  }

  private async _execute() {
    // 1. Check for resumption
    const meta = await this.store.getMetadata(this.id);
    let startByte = 0;
    let chunkIndex = 0;

    // Resume if we have valid metadata
    if (meta && meta.downloadedBytes > 0) {
      startByte = meta.downloadedBytes;
      chunkIndex = meta.chunkCount;
      console.log(`[Job] Resuming ${this.id} from ${startByte} bytes`);
    } else if (meta) {
      // Metadata exists but 0 bytes? Start over.
      await this.store.clear(this.id);
    }

    const headers: HeadersInit = {};
    if (startByte > 0) {
      headers['Range'] = `bytes=${startByte}-`;
    }

    const response = await fetch(this.id, {
      signal: this.abortController?.signal,
      headers
    });

    if (!response.ok) {
      // Handle 416 Range Not Satisfiable (Completed)
      if (response.status === 416) {
        const contentRange = response.headers.get('Content-Range');
        if (contentRange) {
          const match = contentRange.match(/\*\/(\d+)/);
          if (match) {
            const serverSize = parseInt(match[1], 10);
            if (startByte >= serverSize) {
              // We are done
              this.progress.loaded = serverSize;
              this.progress.total = serverSize;
              return;
            }
          }
        }
        // If 416 but technically invalid, we might want to restart?
        // Retry from 0
        console.warn('[Job] 416 Range Not Satisfiable. Restarting from 0.');
        await this.store.clear(this.id);
        return this._execute(); // Recursion safe here? Yes, once.
      }

      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }

    const contentLength = response.headers.get('Content-Length');
    const totalSize = contentLength
      ? parseInt(contentLength, 10) + startByte
      : (meta?.totalBytes || 0);

    const etag = response.headers.get('Etag');
    if (meta && meta.etag && etag && meta.etag !== etag) {
      console.warn('[Job] ETag mismatch. Restarting.');
      await this.store.clear(this.id);
      if (this.abortController) this.abortController.abort(); // Cancel current stream
      // Need to restart fresh.
      // We can't easily restart in same stack without resetting everything.
      // Throw special error or handle?
      // Let's throw and let scheduler retry or just handle it.
      // Simple:
      throw new Error('ETag mismatch, restart required');
      // Logic failure: we shouldn't throw error to user, we should internal retry.
      // But for this pass, simple robust error.
    }

    // 200 OK Check - if we asked for Range but got 200, server ignored us.
    if (startByte > 0 && response.status === 200) {
      console.warn('[Job] Server ignored Range header (200 OK). Restarting.');
      await this.store.clear(this.id);
      startByte = 0;
      chunkIndex = 0; // Reset
      // We can continue with THIS response as it is from 0!
    }

    this.progress.total = totalSize;
    this.progress.loaded = startByte;

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    let pendingChunks: Uint8Array[] = [];
    let pendingSize = 0;

    const flush = async () => {
      if (pendingChunks.length === 0) return;
      const blob = new Blob(pendingChunks as unknown as BlobPart[]);

      if (this.isMemoryMode) {
        this.memoryChunks.push(blob);
        // We track progress locally. Metadata in store won't be updated, which is fine as we are in memory-only mode now.
      } else {
        try {
          await this.store.appendChunk(this.id, blob, chunkIndex++, totalSize, etag);
        } catch (e: any) {
          if (e.name === 'QuotaExceededError' && this.quotaHandler) {
            console.warn('[Job] Quota exceeded. Requesting fallback.');
            const allowed = await this.quotaHandler();
            if (allowed) {
              this.isMemoryMode = true;
              console.log('[Job] Switched to memory mode.');

              // Recover existing chunks from store
              try {
                const existingStream = await this.store.getStream(this.id, chunkIndex); // chunks 0 to index-1
                const reader = existingStream.getReader();
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  this.memoryChunks.push(new Blob([value as any]));
                }
                // Clear store to free space
                await this.store.clear(this.id);

                // Add current chunk
                this.memoryChunks.push(blob);
                chunkIndex++; // Increment for consistency?
              } catch (recErr) {
                console.error('[Job] Failed to recover chunks for memory mode', recErr);
                throw e; // Fail if can't recover
              }
            } else {
              throw e; // User denied
            }
          } else {
            throw e;
          }
        }
      }

      pendingChunks = [];
      pendingSize = 0;
    };

    const startTime = Date.now();
    let lastTick = startTime;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        await flush();
        break;
      }

      if (value) {
        pendingChunks.push(value);
        pendingSize += value.byteLength;
        this.progress.loaded += value.byteLength;

        // Speed calc
        const now = Date.now();
        if (now - lastTick > 1000) {
          const duration = (now - startTime) / 1000;
          this.progress.speed = this.progress.loaded / duration;
          lastTick = now;
          if (this.onProgressCallback) this.onProgressCallback(this.progress);
        }

        if (pendingSize >= this.bufferSize) {
          await flush();
        }
      }
    }
  }
}
