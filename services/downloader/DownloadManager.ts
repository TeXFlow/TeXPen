import { downloadScheduler } from './v2/DownloadScheduler';
import { DownloadProgress } from './types';
import { env } from '@huggingface/transformers';

export class DownloadManager {
  private static instance: DownloadManager;

  private constructor() { }

  public static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager();
    }
    return DownloadManager.instance;
  }

  // Legacy method signature compatibility
  public setQuotaErrorHandler(handler: () => Promise<boolean>) {
    // V2 doesn't use this yet
    console.warn('Quota error handler not yet implemented in V2');
  }

  public async downloadFile(url: string, onProgress?: (progress: DownloadProgress) => void): Promise<void> {
    // 1. Check Cache API first
    // @ts-expect-error - env.cacheName exists in runtime
    const cacheName = env.cacheName || 'transformers-cache';
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(url);

    if (cachedResponse) {
      const contentLength = cachedResponse.headers.get('Content-Length');
      const expectedSize = contentLength ? parseInt(contentLength, 10) : 0;
      if (expectedSize > 0) {
        return;
      }
    }

    // 2. Delegate to V2 Scheduler
    await downloadScheduler.download(url, (p) => {
      if (onProgress) {
        onProgress({
          loaded: p.loaded,
          total: p.total,
          file: url.split('/').pop() || 'unknown'
        });
      }
    });

    // 3. Move from IDB to Cache API
    await this.finalizeCache(url, cache);
  }

  private async finalizeCache(url: string, cache: Cache) {
    const store = downloadScheduler.getStore();
    const meta = await store.getMetadata(url);

    if (!meta) throw new Error(`Download failed: Metadata missing for ${url}`);

    // Validation
    if (meta.downloadedBytes !== meta.totalBytes) {
      throw new Error(`Integrity check failed: ${meta.downloadedBytes} != ${meta.totalBytes}`);
    }

    const stream = await store.getStream(url, meta.chunkCount);
    const response = new Response(stream, {
      headers: {
        'Content-Length': meta.totalBytes.toString(),
        'Content-Type': 'application/octet-stream'
      }
    });

    await cache.put(url, response);
    await store.clear(url);
  }

  public async checkCacheIntegrity(url: string): Promise<{ ok: boolean, reason?: string, missing?: boolean }> {
    // @ts-expect-error - env.cacheName exists
    const cacheName = env.cacheName || 'transformers-cache';
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(url);

    if (!cachedResponse) {
      return { ok: false, missing: true, reason: 'File not found in cache' };
    }

    return { ok: true };
  }
}

export const downloadManager = DownloadManager.getInstance();
