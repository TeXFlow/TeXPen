export const MODEL_CONFIG = {
  ID: 'Ji-Ha/TexTeller3-ONNX-dynamic',
  DEFAULT_QUANTIZATION: 'fp32',
  DEFAULT_PROVIDER: 'webgpu',

  // Model Specs
  IMAGE_SIZE: 448,
  MEAN: [0.9545467],
  STD: [0.15394445],

  // Input/Output Names
  ENCODER_INPUT_NAME: 'pixel_values',
  DECODER_INPUT_NAME: 'decoder_input_ids',
  DECODER_OUTPUT_NAME: 'logits',

  // Special Tokens
  TOKENS: {
    EOS: '</s>',
    BOS: '<s>',
    PAD: '<pad>',
  },

  // Environment / Backend
  PROVIDERS: {
    WEBGPU: 'webgpu',
    WASM: 'wasm',
  },
  QUANTIZATION: {
    FP32: 'fp32',
    FP16: 'fp16',
    Q8: 'q8',
  },
  FALLBACK: {
    PROVIDER: 'wasm',
    QUANTIZATION: 'q8',
  },
} as const;
