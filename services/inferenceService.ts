import { AutoTokenizer, AutoModelForVision2Seq, PreTrainedModel, PreTrainedTokenizer, Tensor } from '@huggingface/transformers';
import { removeStyle, addNewlines } from './latexUtils';
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
        dtype: options.dtype || 'q8',    // Use q8 quantization for faster inference
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
        max_new_tokens: 512,
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

    // 3. Multi-candidate generation using sampling for diversity
    // Generate multiple sequences with temperature-based sampling
    const candidates: string[] = [];
    const seenOutputs = new Set<string>();

    // First, get the best greedy result
    const greedyResult = await this.model!.generate({
      pixel_values: pixelValues,
      max_new_tokens: 512,
      do_sample: false,
      pad_token_id: this.tokenizer!.pad_token_id,
      eos_token_id: this.tokenizer!.eos_token_id,
      bos_token_id: this.tokenizer!.bos_token_id,
      decoder_start_token_id: this.tokenizer!.bos_token_id,
    } as any);

    const greedyText = this.tokenizer!.decode(greedyResult[0], { skip_special_tokens: true });
    const greedyProcessed = this.postprocess(greedyText);
    if (greedyProcessed) {
      candidates.push(greedyProcessed);
      seenOutputs.add(greedyProcessed);
    }

    // Generate additional candidates using sampling with different temperatures
    // This is faster than custom beam search because we can parallelize
    const temperatures = [0.3, 0.5, 0.7, 0.9];
    const remainingSlots = numCandidates - candidates.length;

    for (let i = 0; i < remainingSlots && i < temperatures.length; i++) {
      try {
        const sampleResult = await this.model!.generate({
          pixel_values: pixelValues,
          max_new_tokens: 512,
          do_sample: true,
          temperature: temperatures[i],
          top_k: 50,
          top_p: 0.95,
          pad_token_id: this.tokenizer!.pad_token_id,
          eos_token_id: this.tokenizer!.eos_token_id,
          bos_token_id: this.tokenizer!.bos_token_id,
          decoder_start_token_id: this.tokenizer!.bos_token_id,
        } as any);

        const sampleText = this.tokenizer!.decode(sampleResult[0], { skip_special_tokens: true });
        const sampleProcessed = this.postprocess(sampleText);

        if (sampleProcessed && !seenOutputs.has(sampleProcessed)) {
          candidates.push(sampleProcessed);
          seenOutputs.add(sampleProcessed);
        }
      } catch (error) {
        console.warn('[Inference] Sampling failed for temperature', temperatures[i], error);
      }
    }

    console.log(`[Inference] Generated ${candidates.length} candidates`);

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
