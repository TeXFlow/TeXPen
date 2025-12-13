
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InferenceEngine } from '../../../services/inference/InferenceEngine';

describe('InferenceService Memory Leak / Race Condition (InferenceEngine)', () => {
  let engine: InferenceEngine;

  beforeEach(() => {
    engine = new InferenceEngine();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await engine.dispose();
  });

  it('should not load model if disposed immediately after init call (queued init race)', async () => {
    // 1. Mock the ModelLoader to be slow, so we can control the timing
    const { modelLoader } = await import('../../../services/inference/ModelLoader');

    let resolveLoad: (value: any) => void;
    const loadPromise = new Promise((resolve) => {
      resolveLoad = resolve;
    });

    vi.spyOn(modelLoader, 'loadModelWithFallback').mockImplementation(async () => {
      await loadPromise;
      return {
        model: {
          dispose: vi.fn(),
          generate: vi.fn(),
        } as any,
        device: 'cpu'
      };
    });

    vi.spyOn(modelLoader, 'preDownloadModels').mockResolvedValue(undefined);

    // 2. Call init (this will get queued and start waiting on our slow load)
    const initPromise = engine.init(undefined, { device: 'cpu' as any });

    // 3. IMMEDIATELY call dispose.
    // This increments the generation BEFORE the actual "loadModelWithFallback" finishes
    await engine.dispose();

    // 4. Now release the lock (finish the load)
    resolveLoad!({});

    // 5. Wait for init to "finish" (it should handle the silent rejection/return)
    await initPromise;

    // 6. Assertions
    // The model should NOT be set on the engine
    // @ts-ignore - accessing private field
    expect(engine.model).toBeNull();
    // @ts-ignore - accessing private field
    expect(engine.tokenizer).toBeNull();
  });
});
