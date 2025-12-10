import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DownloadManager } from '../../../services/downloader/DownloadManager';
import { getDB, clearPartialDownload } from '../../../services/downloader/db';

// Mock DB with slight delay
vi.mock('../../../services/downloader/db', () => ({
  getDB: vi.fn(),
  saveChunk: vi.fn().mockImplementation(async () => {
    // Simulate 2ms/write (very optimistic for IDB transaction creation + write)
    await new Promise(r => setTimeout(r, 2));
  }),
  getPartialDownload: vi.fn(),
  clearPartialDownload: vi.fn(),
}));

// Access mocked functions
import { saveChunk } from '../../../services/downloader/db';

describe('DownloadManager Benchmark', () => {
  let downloadManager: DownloadManager;

  beforeEach(() => {
    downloadManager = DownloadManager.getInstance();
    vi.clearAllMocks();
    global.fetch = vi.fn();
    (global as any).caches = {
      open: vi.fn().mockResolvedValue({
        match: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      }),
    };
  });

  it('baseline: direct fetch (no overhead)', async () => {
    const CHUNK_SIZE = 64 * 1024;
    const TOTAL_SIZE = 50 * 1024 * 1024;
    const ITERATIONS = TOTAL_SIZE / CHUNK_SIZE;

    const mockContent = new Uint8Array(CHUNK_SIZE);
    const mockStream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < ITERATIONS; i++) {
          controller.enqueue(mockContent);
        }
        controller.close();
      }
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Length': TOTAL_SIZE.toString() }),
      body: mockStream,
    });

    const startTime = performance.now();
    const response = await fetch('https://baseline.com');
    const reader = response.body!.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
    const duration = (performance.now() - startTime) / 1000;
    const speed = (TOTAL_SIZE / 1024 / 1024) / duration;

    console.log(`\n[Benchmark] Baseline Direct: ${(TOTAL_SIZE / 1024 / 1024).toFixed(1)}MB in ${duration.toFixed(3)}s (${speed.toFixed(2)} MB/s)`);
  });

  it('benchmark download manager (optimize buffering)', async () => {
    const CHUNK_SIZE = 64 * 1024; // 64KB
    const TOTAL_SIZE = 50 * 1024 * 1024; // Increase to 50MB to trigger flush logic
    const ITERATIONS = TOTAL_SIZE / CHUNK_SIZE;

    const mockContent = new Uint8Array(CHUNK_SIZE);

    // Create a stream that yields chunks fast
    const mockStream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < ITERATIONS; i++) {
          controller.enqueue(mockContent);
        }
        controller.close();
      }
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Length': TOTAL_SIZE.toString() }),
      body: mockStream,
    });

    const startTime = performance.now();
    await downloadManager.downloadFile('https://bench.com/file');
    const params = performance.now() - startTime;

    const mb = TOTAL_SIZE / 1024 / 1024;
    const seconds = params / 1000;
    const speed = mb / seconds; // MB/s

    console.log(`\n[Benchmark] Managed (Buffered): ${mb.toFixed(1)}MB in ${seconds.toFixed(3)}s`);
    console.log(`[Benchmark] Speed: ${speed.toFixed(2)} MB/s`);

    // Should be MUCH faster than 5MB/s. With 2ms delay per flush, and 50MB flush:
    // 50MB = 1 flush = 2ms overhead total.
    // Speed should be essentially equal to baseline.
    expect(speed).toBeGreaterThan(20);
  });
});
