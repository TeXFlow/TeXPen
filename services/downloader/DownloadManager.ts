import { getPartialDownload, saveChunk, clearPartialDownload } from './db';

const CACHE_NAME = 'transformers-cache';

export class DownloadManager {
  private static instance: DownloadManager;
  private abortControllers: Map<string, AbortController> = new Map();

  private constructor() { }

  public static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager();
    }
    return DownloadManager.instance;
  }

  /**
   * Checks if a file exists in the transformers cache
   */
  public async isCached(url: string): Promise<boolean> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const output = await cache.match(url);
      return !!output;
    } catch (e) {
      console.warn('Cache check failed:', e);
      return false;
    }
  }

  /**
   * Downloads a file with support for resuming.
   * Logic:
   * 1. Check if fully cached (transformers-cache). If so, return.
   * 2. Check DB for partial download.
   * 3. Fetch with Range header.
   * 4. Save to transformers-cache when done.
   */
  public async downloadFile(
    url: string,
    onProgress?: (received: number, total: number) => void
  ): Promise<void> {

    // 1. Check existing cache
    if (await this.isCached(url)) {
      // console.log(`[DownloadManager] Already cached: ${url}`);
      // Maybe trigger progress 100%?
      if (onProgress) onProgress(1, 1);
      return;
    }

    // 2. Check for partial
    const partial = await getPartialDownload(url);
    let startByte = 0;
    let existingChunks: Blob[] = [];

    // If we have a partial, verify it's valid (we might want to re-validate Last-Modified or ETag if we could, but Head req is needed)
    // For now, we trust the partial if it exists.
    if (partial) {
      console.log(`[DownloadManager] Resuming ${url} from ${partial.downloadedBytes} bytes`);
      startByte = partial.downloadedBytes;
      existingChunks = partial.chunks;
      if (onProgress) onProgress(startByte, partial.contentLength);
    }

    // 3. Fetch
    const controller = new AbortController();
    this.abortControllers.set(url, controller);

    try {
      const headers: HeadersInit = {};
      if (startByte > 0) {
        headers['Range'] = `bytes=${startByte}-`;
      }

      const response = await fetch(url, {
        headers,
        signal: controller.signal
      });

      if (!response.ok) {
        // If range not satisfiable (e.g. file changed), restart
        if (response.status === 416) {
          console.warn('[DownloadManager] Range not satisfiable, restarting download.');
          await clearPartialDownload(url);
          return this.downloadFile(url, onProgress);
        }
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get('Content-Length');
      const totalSize = startByte + (contentLength ? parseInt(contentLength, 10) : 0);
      const etag = response.headers.get('ETag') || undefined;

      // If server doesn't support range (returns 200 instead of 206), we must restart
      if (startByte > 0 && response.status === 200) {
        console.warn('[DownloadManager] Server did not respect Range header, restarting.');
        startByte = 0;
        existingChunks = [];
        await clearPartialDownload(url); // clear invalid partial
      }

      if (!response.body) throw new Error('Response body is null');

      const reader = response.body.getReader();
      let receivedBytes = startByte;
      const chunks: Blob[] = [...existingChunks];

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        if (value) {
          const chunkBlob = new Blob([value]);
          chunks.push(chunkBlob);
          receivedBytes += value.length;

          // Save chunk to DB
          await saveChunk(url, chunkBlob, totalSize, etag);

          if (onProgress) onProgress(receivedBytes, totalSize);
        }
      }

      // 4. Assemble and Cache
      console.log(`[DownloadManager] Download complete for ${url}. Assembling and caching...`);
      const fullBlob = new Blob(chunks); // Adjust type if needed

      const cache = await caches.open(CACHE_NAME);
      const cacheResponse = new Response(fullBlob, {
        headers: {
          'Content-Length': fullBlob.size.toString(),
          'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
          // Add other headers if necessary for transformers.js
        }
      });

      await cache.put(url, cacheResponse);

      // Clear partial from DB as it is now safe in Cache API
      await clearPartialDownload(url);

      this.abortControllers.delete(url);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`[DownloadManager] Download aborted for ${url}`);
      } else {
        console.error(`[DownloadManager] Error downloading ${url}:`, error);
        throw error;
      }
    }
  }

  public cancelDownload(url: string) {
    const controller = this.abortControllers.get(url);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(url);
    }
  }
}

export const downloadManager = DownloadManager.getInstance();
