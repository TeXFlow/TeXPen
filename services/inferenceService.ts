import { AutoTokenizer, AutoModelForVision2Seq, PreTrainedModel, PreTrainedTokenizer, Tensor } from '@huggingface/transformers';
import { removeStyle, addNewlines } from './latexUtils';
import { formatLatex } from './latexFormatter';
import { trimWhiteBorder, resizeAndPad, FIXED_IMG_SIZE, IMAGE_MEAN, IMAGE_STD } from './imagePreprocessing';

// Constants
const MODEL_ID = 'onnx-community/TexTeller3-ONNX';


export class InferenceService {
  private model: PreTrainedModel | null = null;
  private tokenizer: PreTrainedTokenizer | null = null;
  private static instance: InferenceService;

  private constructor() { }

  public static getInstance(): InferenceService {
    if (!InferenceService.instance) {
      InferenceService.instance = new InferenceService();
    }
    return InferenceService.instance;
  }

  public async init(onProgress?: (status: string) => void, options: { device?: string; dtype?: string } = {}): Promise<void> {
    if (this.model && this.tokenizer) return;

    try {
      if (onProgress) onProgress('Loading tokenizer...');
      this.tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);

      if (onProgress) onProgress('Loading model... (this may take a while)');
      // Force browser cache usage and allow remote models
      this.model = await AutoModelForVision2Seq.from_pretrained(MODEL_ID, {
        device: options.device || 'webgpu', // Try WebGPU first, fallback to wasm automatically
        dtype: options.dtype || 'fp32',    // Use fp32 for unquantized model as requested
      } as any);

      if (onProgress) onProgress('Ready');
    } catch (error) {
      console.error('Failed to load model:', error);
      throw error;
    }
  }

  public async infer(imageBlob: Blob, numCandidates: number = 5): Promise<{ latex: string; candidates: string[]; debugImage: string }> {
    if (!this.model || !this.tokenizer) {
      await this.init();
    }

    // 1. Preprocess
    const { tensor: pixelValues, debugImage } = await this.preprocess(imageBlob);

    // 2. Fast path: if only 1 candidate needed, use simple greedy decoding
    if (numCandidates <= 1) {
      const outputTokenIds = await this.model!.generate({
        pixel_values: pixelValues,
        max_new_tokens: 1024,
        do_sample: false,
        pad_token_id: this.tokenizer!.pad_token_id,
        eos_token_id: this.tokenizer!.eos_token_id,
        bos_token_id: this.tokenizer!.bos_token_id,
        decoder_start_token_id: this.tokenizer!.bos_token_id,
      } as any);

      const generatedText = this.tokenizer!.decode(outputTokenIds[0], {
        skip_special_tokens: true,
      });
      const processed = this.postprocess(generatedText);

      return {
        latex: processed,
        candidates: [processed],
        debugImage
      };
    }

    // 3. Multi-candidate: Custom beam search - step through decoder manually
    const numBeams = numCandidates;
    const maxTokens = 512;
    const eosTokenId = this.tokenizer!.eos_token_id as number;
    const bosTokenId = this.tokenizer!.bos_token_id as number;
    const padTokenId = this.tokenizer!.pad_token_id as number;
    const model = this.model as any;

    // Beam type
    type Beam = { tokens: number[]; score: number; done: boolean };
    let beams: Beam[] = [{ tokens: [bosTokenId], score: 0, done: false }];
    let encoderOutputs: any = null;

    // Step through generation token by token
    for (let step = 0; step < maxTokens; step++) {
      const allCandidates: Beam[] = [];

      for (const beam of beams) {
        if (beam.done) {
          allCandidates.push(beam);
          continue;
        }

        try {
          // Create input tensor for this beam
          const decoderInputIds = new Tensor(
            'int64',
            BigInt64Array.from(beam.tokens.map(t => BigInt(t))),
            [1, beam.tokens.length]
          );

          // Try forward pass to get logits
          let logitsData: Float32Array | null = null;

          if (model.forward) {
            const outputs = await model.forward({
              pixel_values: pixelValues, // Always pass - ONNX doesn't cache encoder
              decoder_input_ids: decoderInputIds,
              use_cache: false,
            });

            const logits = outputs.logits || outputs.decoder_logits;
            if (logits) {
              // Get last token logits
              const seqLen = beam.tokens.length;
              const vocabSize = logits.dims[logits.dims.length - 1];
              const startIdx = (seqLen - 1) * vocabSize;
              logitsData = new Float32Array(logits.data.slice(startIdx, startIdx + vocabSize));
            }
          }

          if (!logitsData) {
            // Fallback: greedy generation
            const result = await model.generate({
              pixel_values: pixelValues,
              max_new_tokens: 1,
              do_sample: false,
              pad_token_id: padTokenId,
              eos_token_id: eosTokenId,
              bos_token_id: bosTokenId,
              decoder_start_token_id: bosTokenId,
            });

            const seqs = result.sequences || result;
            const nextToken = Number(seqs.data[seqs.data.length - 1]);
            allCandidates.push({
              tokens: [...beam.tokens, nextToken],
              score: beam.score,
              done: nextToken === eosTokenId
            });
            continue;
          }

          // Compute log probabilities from logits
          const maxLogit = Math.max(...logitsData);
          const expSum = logitsData.reduce((sum, x) => sum + Math.exp(x - maxLogit), 0);
          const logProbs = Array.from(logitsData).map(x => (x - maxLogit) - Math.log(expSum));

          // Get top-k tokens
          const topK = logProbs
            .map((prob, idx) => ({ prob, idx }))
            .sort((a, b) => b.prob - a.prob)
            .slice(0, numBeams);

          for (const { prob, idx } of topK) {
            allCandidates.push({
              tokens: [...beam.tokens, idx],
              score: beam.score + prob,
              done: idx === eosTokenId
            });
          }

        } catch (error) {
          console.error('[DEBUG] Beam step error:', error);
          // On error, mark beam as done
          allCandidates.push({ ...beam, done: true });
        }
      }

      if (allCandidates.length === 0) break;

      // Keep top beams
      allCandidates.sort((a, b) => b.score - a.score);
      beams = allCandidates.slice(0, numBeams);

      // Check if all done
      if (beams.every(b => b.done)) break;

      // Debug progress
      if (step % 20 === 0) {
        console.log(`[DEBUG] Step ${step}, beams: ${beams.length}, best score: ${beams[0].score.toFixed(2)}`);
      }
    }

    // 3. Decode beams to candidates
    const candidates: string[] = [];
    beams.sort((a, b) => b.score - a.score);

    for (const beam of beams) {
      try {
        const text = this.tokenizer!.decode(beam.tokens, { skip_special_tokens: true });
        const processed = this.postprocess(text);
        if (processed && !candidates.includes(processed)) {
          candidates.push(processed);
          console.log(`[DEBUG] Candidate ${candidates.length}:`, processed);
        }
      } catch (e) {
        console.error('[DEBUG] Decode error:', e);
      }
    }

    console.log(`[DEBUG] Generated ${candidates.length} candidates`);

    return {
      latex: candidates[0] || '',
      candidates,
      debugImage
    };
  }


  private async preprocess(imageBlob: Blob): Promise<{ tensor: Tensor; debugImage: string }> {
    // Convert Blob to ImageBitmap
    const img = await createImageBitmap(imageBlob);

    // 1. Draw to canvas to get pixel data
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to get canvas context');
    ctx.drawImage(img, 0, 0);
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 1.5 Handle Transparency & Theme: Force Black on White
    // The model expects Black text on White background.
    // Our input might be White text on Transparent (Dark Mode) or Black on Transparent (Light Mode).
    const pixelData = imageData.data;
    for (let i = 0; i < pixelData.length; i += 4) {
      const alpha = pixelData[i + 3];
      if (alpha < 50) {
        // Transparent -> White
        pixelData[i] = 255;     // R
        pixelData[i + 1] = 255; // G
        pixelData[i + 2] = 255; // B
        pixelData[i + 3] = 255; // Alpha
      } else {
        // Content -> Black
        pixelData[i] = 0;       // R
        pixelData[i + 1] = 0;   // G
        pixelData[i + 2] = 0;   // B
        pixelData[i + 3] = 255; // Alpha
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // 2. Trim white border
    imageData = trimWhiteBorder(imageData);

    // 3. Resize and Pad (Letterbox) to FIXED_IMG_SIZE
    const processedCanvas = resizeAndPad(imageData, FIXED_IMG_SIZE);
    const processedCtx = processedCanvas.getContext('2d');
    const processedData = processedCtx!.getImageData(0, 0, FIXED_IMG_SIZE, FIXED_IMG_SIZE);

    // 4. Normalize and create Tensor
    // transformers.js expects [batch_size, channels, height, width]
    // We need to flatten it to [1, 1, 448, 448] (grayscale)

    // DEBUG: Log the preprocessed image
    const debugImage = canvas.toDataURL();
    // console.log('[DEBUG] Preprocessed Input Image:', debugImage);

    const float32Data = new Float32Array(FIXED_IMG_SIZE * FIXED_IMG_SIZE);
    const { data } = processedData;

    let minVal = Infinity, maxVal = -Infinity, sumVal = 0;

    for (let i = 0; i < FIXED_IMG_SIZE * FIXED_IMG_SIZE; i++) {
      // Convert RGB to Grayscale using PyTorch standard weights: 0.299*R + 0.587*G + 0.114*B
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Normalize: (pixel/255 - mean) / std
      const normalized = ((gray / 255.0) - IMAGE_MEAN) / IMAGE_STD;
      float32Data[i] = normalized;

      // Stats for debugging
      if (normalized < minVal) minVal = normalized;
      if (normalized > maxVal) maxVal = normalized;
      sumVal += normalized;
    }

    return {
      tensor: new Tensor(
        'float32',
        float32Data,
        [1, 1, FIXED_IMG_SIZE, FIXED_IMG_SIZE]
      ),
      debugImage
    };
  }



  private postprocess(latex: string): string {
    // 1. Remove style (bold, italic, etc.) - optional but recommended for cleaner output
    let processed = removeStyle(latex);

    // 2. Add newlines for readability
    processed = addNewlines(processed);

    // 3. Apply advanced formatting (indentation, wrapping)
    // DISABLED: Formatter was removing \begin{split} environments
    // processed = formatLatex(processed);

    return processed;
  }

  public async dispose(): Promise<void> {
    if (this.model) {
      if ('dispose' in this.model && typeof (this.model as any).dispose === 'function') {
        await (this.model as any).dispose();
      }
      this.model = null;
    }
    this.tokenizer = null;
    (InferenceService as any).instance = null;
  }
}

export const inferenceService = InferenceService.getInstance();
