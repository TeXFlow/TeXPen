/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { DownloadManager } from '../../../services/downloader/DownloadManager';
import { downloadScheduler } from '../../../services/downloader/v2/DownloadScheduler';

// Mock ChunkStore
const { mockStore } = vi.hoisted(() => {
  return {
    mockStore: {
      getMetadata: vi.fn(),
      appendChunk: vi.fn(),
      clear: vi.fn(),
      getStream: vi.fn(),
      virtualAppend: vi.fn(),
    }
  };
});

vi.mock('../../../services/downloader/v2/ChunkStore', () => {
  return {
    ChunkStore: class {
      constructor() {
        return mockStore;
      }
    }
  };
});

// Mock globals
global.fetch = vi.fn();
global.caches = {
  open: vi.fn().mockResolvedValue({
    match: vi.fn().mockResolvedValue(null),
    put: vi.fn(),
    delete: vi.fn(),
  }),
} as any;

describe('DownloadManager Quota Handling (V2)', () => {
  let downloadManager: DownloadManager;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Reset Scheduler
    (downloadScheduler as any).jobs = new Map();
    (downloadScheduler as any).queue = [];
    (downloadScheduler as any).activeCount = 0;
    (downloadScheduler as any).store = mockStore; // Inject mock store if needed, though constructor mock handles it for new instances
    // But Scheduler is singleton instantiated at module load.
    // We might need to force re-instantiation of Scheduler if we can't reset it.
    // Actually, since we mock ChunkStore module, the invalidation might not propagate to already instantiated Scheduler?
    // DownloadScheduler instantiated `this.store = new ChunkStore()` in constructor.
    // Only if we re-import Scheduler will it pick up new mock?
    // Or we just hack the private property.
    (downloadScheduler as any).store = mockStore;

    // Reset Manager
    // (DownloadManager as any).instance = undefined; // Force new instance?
    // downloadManager = DownloadManager.getInstance();
    // Ideally we reuse the instance but ensure state is clean.
    downloadManager = DownloadManager.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should trigger quota handler and switch to memory on error', async () => {
    const quotaHandler = vi.fn().mockResolvedValue(true);
    downloadManager.setQuotaErrorHandler(quotaHandler);

    // Mock store to fail on appendChunk
    mockStore.getMetadata.mockResolvedValue(null);
    mockStore.appendChunk.mockRejectedValueOnce(new DOMException('QuotaExceededError', 'QuotaExceededError'));

    // Mock store.getStream for recovery (simulating it had 0 chunks before fail, or fails on first chunk)
    // If it fails on first chunk, we don't need recovery of previous chunks.
    // Let's testing failing on 2nd chunk to test recovery.

    // Scenario:
    // Chunk 0: Success
    // Chunk 1: Fail -> Trigger Quota -> Accept -> Recovery (read Chunk 0) -> Store Clear -> Memory Append

    // We need to control appendChunk behavior sequentially.
    // Call 1 (Chunk 0): Success
    // Call 2 (Chunk 1): Fail
    mockStore.appendChunk
      .mockResolvedValueOnce(undefined) // Chunk 0
      .mockRejectedValueOnce({ name: 'QuotaExceededError' }); // Chunk 1

    // Mock recovery stream
    mockStore.getStream.mockResolvedValue(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3])); // Chunk 0 data
        controller.close();
      }
    }));

    // Mock fetch stream (2 chunks)
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      headers: {
        get: (key: string) => key === 'Content-Length' ? '20' : null
      },
      body: {
        getReader: () => {
          let callCount = 0;
          return {
            read: async () => {
              if (callCount === 0) {
                callCount++;
                return { done: false, value: new Uint8Array([1, 2, 3]) }; // Chunk 0
              }
              if (callCount === 1) {
                callCount++;
                return { done: false, value: new Uint8Array([4, 5, 6]) }; // Chunk 1
              }
              return { done: true, value: undefined };
            }
          };
        }
      }
    } as any);

    await downloadManager.downloadFile('http://example.com/quota.onnx');

    // Verification
    expect(quotaHandler).toHaveBeenCalled();
    expect(mockStore.clear).toHaveBeenCalledWith('http://example.com/quota.onnx'); // Called during recovery AND finalize

    // Check Cache Put
    const cacheOpen = await caches.open('transformers-cache');
    expect(cacheOpen.put).toHaveBeenCalled();
    const response = (cacheOpen.put as Mock).mock.calls[0][1] as Response;
    const blob = await response.blob();
    expect(blob.size).toBe(6); // 3 bytes + 3 bytes
  });

  it('should throw error if quota handler returns false', async () => {
    const quotaHandler = vi.fn().mockResolvedValue(false); // User says NO
    downloadManager.setQuotaErrorHandler(quotaHandler);

    mockStore.getMetadata.mockResolvedValue(null);
    mockStore.appendChunk.mockRejectedValue({ name: 'QuotaExceededError' });

    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      headers: { get: () => '10' },
      body: {
        getReader: () => {
          let callCount = 0;
          return {
            read: async () => {
              if (callCount++ === 0) return { done: false, value: new Uint8Array([1]) };
              return { done: true, value: undefined };
            }
          };
        }
      }
    } as any);

    await expect(downloadManager.downloadFile('http://example.com/fail.onnx'))
      .rejects.toThrow('QuotaExceededError');

    expect(quotaHandler).toHaveBeenCalled();
  });
});
