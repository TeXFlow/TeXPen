import { describe, it, expect, vi, beforeEach } from 'vitest';
import { beamSearch } from '../../../services/inference/beamSearch';
import { Tensor } from '@huggingface/transformers';

// Mock Tensor
vi.mock('@huggingface/transformers', () => ({
  Tensor: class {
    constructor(public type: string, public data: any, public dims: any[]) { }
    dispose() { }
    getData() { return Promise.resolve(this.data); }
  },
  PreTrainedModel: class { },
  PreTrainedTokenizer: class { }
}));

describe('beamSearch (Refactored)', () => {
  let mockModel: any;
  let mockTokenizer: any;
  let mockPixelValues: any;
  let mockDecoderSession: any;

  beforeEach(() => {
    mockDecoderSession = {
      run: vi.fn(),
      inputNames: ['decoder_input_ids', 'encoder_hidden_states', 'use_cache_branch', 'past_key_values.0.decoder.key'],
    };

    mockModel = {
      encoder: vi.fn().mockResolvedValue({ last_hidden_state: new Tensor('float32', [], [1, 10, 768]) }),
      sessions: {
        decoder: mockDecoderSession
      },
      config: {
        decoder: { num_attention_heads: 12, hidden_size: 768 }
      }
    };

    mockTokenizer = {
      eos_token_id: 2,
      bos_token_id: 1,
      pad_token_id: 0,
      decode: vi.fn((tokens) => `decoded_${tokens.join('_')}`),
    };

    mockPixelValues = new Tensor('float32', [], [1, 3, 224, 224]);
  });

  it('should call encoder and decoder session', async () => {
    // Mock decoder output
    const logitsData = new Float32Array(1 * 1 * 10).fill(0.1); // [B, Seq, Vocab]
    logitsData[2] = 10.0; // EOS token has high score to finish immediately

    mockDecoderSession.run.mockResolvedValue({
      logits: new Tensor('float32', logitsData, [1, 1, 10]),
      'present.0.decoder.key': new Tensor('float32', [], [1, 12, 1, 64])
    });

    const result = await beamSearch(mockModel, mockTokenizer, mockPixelValues, 1);

    expect(mockModel.encoder).toHaveBeenCalledWith({ pixel_values: mockPixelValues });
    expect(mockDecoderSession.run).toHaveBeenCalled();
    expect(result.length).toBeGreaterThan(0);
  });

  it('should pass correct inputs to decoder session', async () => {
    const logitsData = new Float32Array(1 * 1 * 10).fill(0.1);
    logitsData[2] = 10.0; // EOS

    mockDecoderSession.run.mockResolvedValue({
      logits: new Tensor('float32', logitsData, [1, 1, 10]),
      'present.0.decoder.key': new Tensor('float32', [], [1, 12, 1, 64])
    });

    await beamSearch(mockModel, mockTokenizer, mockPixelValues, 1);

    const callArgs = mockDecoderSession.run.mock.calls[0][0];
    // Check key inputs
    expect(callArgs).toHaveProperty('decoder_input_ids');
    expect(callArgs).toHaveProperty('encoder_hidden_states');
    expect(callArgs).toHaveProperty('use_cache_branch');
    // dummy pkv
    expect(callArgs).toHaveProperty('past_key_values.0.decoder.key');
  });
});
