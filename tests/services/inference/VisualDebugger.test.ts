
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InferenceEngine } from '../../../services/inference/InferenceEngine'; // CHANGED: Target Engine
import { SamplingOptions } from '../../../services/inference/types';

// Mock dependencies
vi.mock('../../../services/inference/imagePreprocessing', () => ({
  preprocess: vi.fn().mockResolvedValue({
    tensor: { dispose: vi.fn() },
    debugImage: 'debug_image_data_url'
  })
}));

vi.mock('../../../services/inference/beamSearch', () => ({
  beamSearch: vi.fn().mockResolvedValue(['beam_result'])
}));

vi.mock('../../../utils/latex', () => ({
  removeStyle: (s: string) => s,
  addNewlines: (s: string) => s
}));

// Mock config
vi.mock('../../../services/inference/config', () => ({
  MODEL_CONFIG: {
    DEFAULT_QUANTIZATION: 'q8',
    ID: 'test-model',
    PROVIDERS: { WEBGPU: 'webgpu', WASM: 'wasm' },
    QUANTIZATION: { Q8: 'q8' }
  },
  getSessionOptions: vi.fn().mockReturnValue({}),
  getGenerationConfig: vi.fn().mockReturnValue({
    max_new_tokens: 10,
    decoder_start_token_id: 1,
    repetition_penalty: 1.0
  })
}));

describe('Visual Debugger Callback Verification (InferenceEngine)', () => {
  let engine: InferenceEngine;
  let mockModel: any;
  let mockTokenizer: any;

  beforeEach(() => {
    engine = new InferenceEngine();

    // Mock internal model and tokenizer
    mockModel = {
      generate: vi.fn().mockResolvedValue([[101]]),
      dispose: vi.fn(),
      config: { device: 'webgpu' }
    };
    mockTokenizer = {
      batch_decode: vi.fn().mockReturnValue(['decoded_latex'])
    };

    // Inject mocks directly to bypass init
    (engine as any).model = mockModel;
    (engine as any).tokenizer = mockTokenizer;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call onPreprocess callback with debug image during inference', async () => {
    const blob = new Blob([]);
    const onPreprocess = vi.fn();
    const options: SamplingOptions = {
      onPreprocess,
      do_sample: false
    };

    await engine.infer(blob, options);

    // Verify callback was called with the mock debug image
    expect(onPreprocess).toHaveBeenCalledWith('debug_image_data_url');
  });
});
