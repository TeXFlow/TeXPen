
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DownloadManager } from '../../../services/downloader/DownloadManager';


// Mock dependencies
vi.mock('../../../services/downloader/ParallelDownloader', () => {
  return {
    ParallelDownloader: class MockParallelDownloader {
      start = vi.fn(() => {
        return new Promise((resolve, reject) => {
          (this as unknown as { _reject: (reason?: unknown) => void })._reject = reject;
        });
      });
      abort = vi.fn(() => {
        if ((this as unknown as { _reject: (reason?: unknown) => void })._reject) {
          (this as unknown as { _reject: (reason?: unknown) => void })._reject(new Error('Download aborted'));
        }
      });

      constructor(public url: string, public store: unknown, public options: unknown) { }
    }
  };
});

vi.mock('../../../services/downloader/ChunkStore', () => {
  return {
    ChunkStore: class MockChunkStore {
      deleteFile = vi.fn(async () => { });
      initFile = vi.fn();
      saveChunk = vi.fn();
      getMetadata = vi.fn();
      getStream = vi.fn();
    }
  };
});

// Mock global caches
vi.stubGlobal('caches', {
  open: vi.fn(async () => ({
    delete: vi.fn(async () => { }),
    put: vi.fn(async () => { }),
    match: vi.fn(async () => null),
  })),
});

describe('DownloadManager Cancellation', () => {
  let downloadManager: DownloadManager;

  beforeEach(() => {
    downloadManager = DownloadManager.getInstance();

    // Reset state manually
    (downloadManager as unknown as { activeDownloads: Map<string, unknown> }).activeDownloads.clear();
    (downloadManager as unknown as { queue: unknown[] }).queue = [];
    (downloadManager as unknown as { activeCount: number }).activeCount = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should cancel an active download when deleteFromCache is called', async () => {
    const url = 'https://example.com/model.onnx';
    const p = downloadManager.downloadFile(url);

    // Wait for it to start
    await new Promise(r => setTimeout(r, 0));

    expect((downloadManager as unknown as { activeDownloads: Map<string, unknown> }).activeDownloads.has(url)).toBe(true);

    await downloadManager.deleteFromCache(url);

    await expect(p).rejects.toThrow('Download aborted');
    expect((downloadManager as unknown as { activeDownloads: Map<string, unknown> }).activeDownloads.has(url)).toBe(false);
  });

  it('should remove from queue if cancelled before starting', async () => {
    const url1 = 'https://example.com/1';
    const url2 = 'https://example.com/2';
    const url3 = 'https://example.com/3';

    downloadManager.downloadFile(url1);
    downloadManager.downloadFile(url2);
    const p3 = downloadManager.downloadFile(url3);

    await new Promise(r => setTimeout(r, 0));
    expect((downloadManager as unknown as { queue: unknown[] }).queue.length).toBe(1);

    await downloadManager.cancelDownload(url3);

    await expect(p3).rejects.toThrow('Download cancelled');
    expect((downloadManager as unknown as { queue: unknown[] }).queue.length).toBe(0);
  });
});
