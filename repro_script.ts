
import { beamSearch } from './services/inference/beamSearch';
import { Tensor } from '@huggingface/transformers';

// Simple mock for Tensor because we can't easily import the real one if we want to mock behavior, 
// OR we just use the real one if installed. 
// "onnxruntime-web" and "@huggingface/transformers" are in package.json.
// But beamSearch uses `isTensor` check which checks for `dims` and `getData`.

// Let's rely on the real Tensor from the package if possible, or a compatible mock.
// The real Tensor might not work if onnx backend is not initialized or compatible with node/bun directly without setup.
// But we used a specific MockTensor in the test file.

class MockTensor {
  type: string;
  data: Float32Array | BigInt64Array | Int32Array;
  dims: number[];

  constructor(type: string, data: any, dims: number[]) {
    this.type = type;
    this.data = data;
    this.dims = dims;
  }

  async getData() {
    return this.data;
  }

  dispose() { }
}

async function main() {
  console.log("Starting reproduction script...");

  const mockPixelValues = new MockTensor('float32', new Float32Array(3 * 224 * 224), [1, 3, 224, 224]);

  const mockTokenizer = {
    eos_token_id: 2,
    bos_token_id: 1,
    pad_token_id: 0,
    decode: (tokens: number[], options: any) => {
      if (options?.skip_special_tokens) {
        return tokens.filter((t: number) => t > 2).map((t: number) => `token_${t}`).join(' ');
      }
      return tokens.map((t: number) => `token_${t}`).join(' ');
    },
  };

  const mockModel = {
    config: {
      eos_token_id: 2,
      decoder_start_token_id: 1,
      pad_token_id: 0,
    },
    encoder: async (args: any) => {
      console.log("[MockEncoder] Called");
      return { last_hidden_state: 'mock_encoder_output' };
    },
    forward: async (inputs: any) => {
      console.log(`[MockForward] Called. Inputs: ${Object.keys(inputs).join(', ')}`);

      const batchSize = inputs.decoder_input_ids.dims[0];
      const vocabSize = 10;

      // Simply predict token 5, then 6, then EOS (2).
      // We can check inputs.decoder_input_ids to see current state.
      // input is [batch, 1] (last token)

      const inputIds = inputs.decoder_input_ids.data; // BigInt64Array
      const lastToken = Number(inputIds[0]); // assume batch 1

      let targetToken = 2; // EOS default
      if (lastToken === 1) targetToken = 5;      // BOS -> 5
      else if (lastToken === 5) targetToken = 6; // 5 -> 6
      else if (lastToken === 6) targetToken = 2; // 6 -> EOS

      const logitsData = new Float32Array(batchSize * 1 * vocabSize).fill(-10);
      logitsData[targetToken] = 10;

      const logits = new MockTensor('float32', logitsData, [batchSize, 1, vocabSize]);

      const presentKV: Record<string, MockTensor> = {};
      const kvData = new Float32Array(batchSize * 16 * 4 * 64).fill(0.1);
      presentKV['present.0.decoder.key'] = new MockTensor('float32', kvData, [batchSize, 16, 4, 64]);
      presentKV['present.0.decoder.value'] = new MockTensor('float32', kvData, [batchSize, 16, 4, 64]);

      return {
        logits,
        ...presentKV
      };
    },
  };

  try {
    const result = await beamSearch(mockModel as any, mockTokenizer as any, mockPixelValues as any, 1);
    console.log("Beam Search Result:", result);
  } catch (err) {
    console.error("Beam Search Failed:", err);
  }
}

main();
