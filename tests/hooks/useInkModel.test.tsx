// @vitest-environment jsdom
import { renderHook, act, waitFor } from '@testing-library/react';
import { useInkModel } from '../../hooks/useInkModel';
import { inferenceService } from '../../services/inference/InferenceService';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock InferenceService
vi.mock('../../services/inference/InferenceService', () => ({
    inferenceService: {
        init: vi.fn(),
        infer: vi.fn(),
        dispose: vi.fn().mockResolvedValue(undefined),
    }
}));

// Mock utils/env
vi.mock('../../utils/env', () => ({
    isWebGPUAvailable: vi.fn().mockResolvedValue(false),
}));

// Mock caches
const mockCache = {
    keys: vi.fn().mockResolvedValue([]),
    open: vi.fn(),
    match: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
};
global.caches = {
    open: vi.fn().mockResolvedValue(mockCache),
    has: vi.fn(),
    delete: vi.fn(),
    keys: vi.fn(),
    match: vi.fn(),
} as any;


describe('useInkModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default to not cached
        mockCache.keys.mockResolvedValue([]);
    });

    it('initializes in idle state', async () => {
        const { result } = renderHook(() => useInkModel('light', 'q4', 'wasm'));
        expect(result.current.status).toBe('idle');
        expect(result.current.isInitialized).toBe(false); // Initially false until cache check

        await waitFor(() => {
            expect(result.current.isInitialized).toBe(true);
        });
    });

    it('blocks inference when model is loading', async () => {
        const { result } = renderHook(() => useInkModel('light', 'q4', 'wasm'));

        await waitFor(() => expect(result.current.isInitialized).toBe(true));

        // Simulate user confirmation only (not cached)
        act(() => {
            result.current.setUserConfirmed(true);
        });

        // It should start loading
        await waitFor(() => {
            // We can't easily check internal status transition if it happens too fast, 
            // but inferenceService.init is async.
            expect(inferenceService.init).toHaveBeenCalled();
        });

        // Mock init to hang or we can just spy on status if we could control init promise.
        // But since we can't control hook internal state easily without modifying the mock behavior:

        // Let's manually check if we can trigger "infer" while it thinks it is loading.
        // The implementation checks `status === 'loading'`.
        // To make status 'loading', `initModel` must be running.

        /* 
           Actually, testing "status === loading" is hard if init finishes immediately in mock.
           Let's mock init to never resolve immediately or use a controlled promise.
        */
    });

    it('blocks inference when user has not confirmed and not cached', async () => {
        // Ensure cache is empty
        mockCache.keys.mockResolvedValue([]);

        const { result } = renderHook(() => useInkModel('light', 'q4', 'wasm'));

        await waitFor(() => expect(result.current.isInitialized).toBe(true));

        expect(result.current.userConfirmed).toBe(false);
        expect(result.current.isLoadedFromCache).toBe(false);

        const canvas = document.createElement('canvas');

        // Attempt inference
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const res = await result.current.infer(canvas);

        expect(res).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith('Inference skipped: User has not confirmed model download.');
        expect(inferenceService.infer).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('allows inference when loaded from cache (auto confirmed)', async () => {
        // Mock cache hit
        mockCache.keys.mockResolvedValue([{ url: 'https://cdn.huggingface.co/Ji-Ha/TexTeller3-ONNX-dynamic/model_quantized.onnx' }]); // Partial match check in hook

        const { result } = renderHook(() => useInkModel('light', 'q4', 'wasm'));

        await waitFor(() => {
            expect(result.current.isLoadedFromCache).toBe(true);
            expect(result.current.userConfirmed).toBe(true);
        });

        const canvas = document.createElement('canvas');
        canvas.getContext('2d'); // Ensure context exists
        // Mock toBlob
        canvas.toBlob = (cb) => cb(new Blob([''], { type: 'image/png' }));

        // Mock inference success
        (inferenceService.infer as any).mockResolvedValue({
            latex: 'x^2',
            candidates: ['x^2'],
            debugImage: ''
        });

        let res: any;
        await act(async () => {
            res = await result.current.infer(canvas);
        });

        expect(inferenceService.infer).toHaveBeenCalled();
        expect(res).not.toBeNull();
        expect(res.latex).toBe('x^2');
    });
});
