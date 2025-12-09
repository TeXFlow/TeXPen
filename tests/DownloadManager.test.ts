// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DownloadManager } from '../services/downloader/DownloadManager';
import * as db from '../services/downloader/db';

// Mock DB
vi.mock('../services/downloader/db', () => ({
  getPartialDownload: vi.fn(),
  saveChunk: vi.fn(),
  clearPartialDownload: vi.fn(),
  getDB: vi.fn(), // If needed
}));

// Mock caches
const mockCacheStorage = {
  open: vi.fn(),
  match: vi.fn(),
  put: vi.fn(),
};
const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
};
global.caches = mockCacheStorage as any;

describe('DownloadManager', () => {
  let downloadManager: DownloadManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheStorage.open.mockResolvedValue(mockCache);
    // Reset singleton if possible, or just get instance (it's a singleton so state might persist)
    // Since we mock deps, it's safer.
    downloadManager = DownloadManager.getInstance();

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('checks cache first', async () => {
    mockCache.match.mockResolvedValue(new Response('cached'));
    const onProgress = vi.fn();

    await downloadManager.downloadFile('http://example.com/file', onProgress);

    expect(mockCache.match).toHaveBeenCalledWith('http://example.com/file');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(1, 1);
  });

  it('starts fresh download if no partial exists', async () => {
    mockCache.match.mockResolvedValue(undefined);
    (db.getPartialDownload as any).mockResolvedValue(undefined);

    const mockResponse = new Response('content', {
      headers: { 'Content-Length': '7', 'Content-Type': 'text/plain' }
    });
    (global.fetch as any).mockResolvedValue(mockResponse);

    const onProgress = vi.fn();
    await downloadManager.downloadFile('http://example.com/file', onProgress);

    expect(global.fetch).toHaveBeenCalledWith('http://example.com/file', expect.objectContaining({
      headers: {}, // No range
    }));
    expect(mockCache.put).toHaveBeenCalled();
    expect(db.saveChunk).toHaveBeenCalled();
  });

  it('resumes download if partial exists', async () => {
    mockCache.match.mockResolvedValue(undefined);
    (db.getPartialDownload as any).mockResolvedValue({
      url: 'http://example.com/file',
      downloadedBytes: 5,
      chunks: [new Blob(['start'])],
      contentLength: 10
    });

    // Mock response for the rest
    const mockResponse = new Response('end', {
      headers: { 'Content-Length': '5', 'Content-Type': 'text/plain' } // Remaining 5 bytes
    });
    (global.fetch as any).mockResolvedValue(mockResponse);

    const onProgress = vi.fn();
    await downloadManager.downloadFile('http://example.com/file', onProgress);

    // Verify Range header
    expect(global.fetch).toHaveBeenCalledWith('http://example.com/file', expect.objectContaining({
      headers: { 'Range': 'bytes=5-' }
    }));

    // Verify it assembled the blob (start + end)
    // Since we can't easily check the Blob content passed to cache.put without reading it,
    // we assume logic holds if it called put.
    expect(mockCache.put).toHaveBeenCalledWith('http://example.com/file', expect.any(Response));
  });

  it('handles range not satisfiable by restarting', async () => {
    mockCache.match.mockResolvedValue(undefined);
    (db.getPartialDownload as any).mockResolvedValue({
      downloadedBytes: 100, // file shrank?
      chunks: [],
      contentLength: 50
    });

    // First call returns 416
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 416,
      })
      .mockResolvedValueOnce(new Response('fresh content', {
        headers: { 'Content-Length': '13' }
      }));

    await downloadManager.downloadFile('http://example.com/file');

    expect(db.clearPartialDownload).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
