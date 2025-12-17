
import {
  InferenceResult,
  InferenceOptions,
  SamplingOptions,
  ParagraphInferenceResult,
  BBox
} from "./types";
import { InferenceEngine } from "./InferenceEngine";
import { bboxMerge, splitConflict, sortBoxes } from "./utils/boxUtils";
import { maskImg, sliceFromImage } from "./utils/imageUtils";
import { removeStyle, addNewlines } from "../../utils/latex";
import { InferenceSession } from "onnxruntime-web";
import { preprocessYolo } from "./utils/yoloPreprocess";
import { yoloPostprocess } from "./utils/yoloPostprocess";
import { downloadManager } from "../downloader/DownloadManager";
import { MODEL_CONFIG } from "./config";
import { preprocessDBNet } from "./utils/dbnetPreprocess";
import { dbnetPostprocess } from "./utils/dbnetPostprocess";

import { modelLoader } from "./ModelLoader";
import { preprocessTrOCR } from "./utils/trocrPreprocess";
import { AutoTokenizer, PreTrainedTokenizer, VisionEncoderDecoderModel, Tensor } from "@huggingface/transformers";
import { getSessionOptions } from "./config";

// Custom filenames for Text Recognition models in the same repo
// const TEXT_ENC_NAME = "onnx/text_recognizer_encoder.onnx";
// const TEXT_DEC_NAME = "onnx/text_recognizer_decoder_with_past.onnx";
// Start with a hardcoded name in the repo, or add to config later.
// "detection.onnx" needs to exist in the HF repo.
// Start with a hardcoded name in the repo, or add to config later.
// "detection.onnx" needs to exist in the HF repo.


export class ParagraphInferenceEngine {
  private latexRecEngine: InferenceEngine;
  private latexDetSession: InferenceSession | null = null;
  private textDetSession: InferenceSession | null = null;
  private textRecModel: VisionEncoderDecoderModel | null = null;
  private textRecTokenizer: PreTrainedTokenizer | null = null;

  // We need models for:
  // 1. Latex Detection (YOLO/ONNX)
  // 2. Text Detection (DBNet/ONNX)
  // 3. Text Recognition (CRNN/ONNX)

  // For now, we assume these are initialized or passed in. 
  // Since loading 4 models in browser is heavy, we might lazy load them.

  constructor(latexRecEngine: InferenceEngine) {
    this.latexRecEngine = latexRecEngine;
  }

  public async init(onProgress?: (status: string, progress?: number) => void) {
    if (this.latexDetSession) return; // Already init

    if (onProgress) onProgress("Initializing Paragraph Models...", 0);

    // Load Latex Detection Model (YOLO)
    try {
      const modelId = MODEL_CONFIG.ID;
      const fileUrl = `https://huggingface.co/${modelId}/resolve/main/${MODEL_CONFIG.LATEX_DET_MODEL}`;

      if (onProgress) onProgress("Downloading Detection Model...", 10);

      // Ensure cached
      await downloadManager.downloadFile(fileUrl, (p) => {
        if (onProgress) onProgress(`Downloading Detection Model...`, Math.round((p.loaded / p.total) * 100));
      });

      // Load from cache or fetch
      // Since downloadManager puts it in cache, we try to read it back.
      // Note: DownloadManager doesn't expose the response directly in a convenient way for resizing?
      // Actually standard Cache API:
      const cache = await caches.open('transformers-cache');
      const response = await cache.match(fileUrl);

      if (!response) {
        throw new Error("Failed to load model from cache after download");
      }

      const modelBlob = await response.blob();
      const modelBuffer = await modelBlob.arrayBuffer();

      if (onProgress) onProgress("Creating Inference Session...", 80);

      // Create Session
      // We assume webgpu is preferred if available?
      // For now, let's try 'webgpu' then 'wasm' fallback?
      // Or just 'wasm' for detection if it's lighter? YOLOv8s is ~20MB. WebGPU is better.
      try {
        this.latexDetSession = await InferenceSession.create(modelBuffer, { executionProviders: ['webgpu', 'wasm'] });
      } catch (e) {
        console.warn("WebGPU failed for detection, falling back to wasm", e);
        this.latexDetSession = await InferenceSession.create(modelBuffer, { executionProviders: ['wasm'] });
      }

      if (onProgress) onProgress("Ready", 100);
    } catch (e) {
      console.error("Failed to init detection model", e);
    } // End Latex Detection Try

    // Load Text Detection Model (DBNet)
    if (!this.textDetSession) {
      try {
        const txtModelId = MODEL_CONFIG.TEXT_DETECTOR_ID;
        const txtFileUrl = `https://huggingface.co/${txtModelId}/resolve/main/${MODEL_CONFIG.TEXT_DET_MODEL}`;

        if (onProgress) onProgress("Downloading Text Detection Model...", 50);

        await downloadManager.downloadFile(txtFileUrl, (p) => {
          if (onProgress) onProgress(`Downloading Text Detection Model...`, Math.round((p.loaded / p.total) * 100));
        });

        const txtCache = await caches.open('transformers-cache');
        const txtResponse = await txtCache.match(txtFileUrl);

        if (txtResponse) {
          const txtBlob = await txtResponse.blob();
          const txtBuffer = await txtBlob.arrayBuffer();

          try {
            this.textDetSession = await InferenceSession.create(txtBuffer, { executionProviders: ['webgpu', 'wasm'] });
          } catch (e) {
            console.warn("WebGPU failed for text detection, falling back to wasm", e);
            this.textDetSession = await InferenceSession.create(txtBuffer, { executionProviders: ['wasm'] });
          }
        } else {
          console.warn("Text detection model fetch failed or empty");
        }
      } catch (e) {
        console.error("Failed to init text detection model", e);
      }
    }

    // Load Text Recognition (TrOCR/Parseq)
    if (!this.textRecModel) {
      try {
        if (onProgress) onProgress("Loading Text Recognition Model...", 70);
        const recModelId = MODEL_CONFIG.TEXT_RECOGNIZER_ID;
        this.textRecTokenizer = await AutoTokenizer.from_pretrained(recModelId);

        try {
          this.textRecModel = await import("@huggingface/transformers").then(m => m.AutoModelForVision2Seq.from_pretrained(recModelId, { device: 'webgpu', dtype: 'fp32' } as any));
        } catch (e) {
          console.warn("WebGPU Text Rec failed, fallback to WASM", e);
          this.textRecModel = await import("@huggingface/transformers").then(m => m.AutoModelForVision2Seq.from_pretrained(recModelId, { device: 'wasm' } as any));
        }
      } catch (e) {
        console.error("Failed to init text recognition model", e);
      }
    }
  }

  public async inferParagraph(
    imageBlob: Blob,
    options: SamplingOptions,
    signal?: AbortSignal
  ): Promise<ParagraphInferenceResult> {

    // 1. Latex Detection
    // Returns list of BBoxes for formulas
    const latexBBoxes = await this.detectLatex(imageBlob);

    // 2. Mask Image
    // Mask out the formulas to avoid text detector picking them up as text
    const maskedImageBlob = await maskImg(imageBlob, latexBBoxes);

    // 3. Text Detection
    // Returns list of BBoxes for text lines
    let textBBoxes = await this.detectText(maskedImageBlob);

    // 4. Merge/Refine BBoxes
    // "ocr_bboxes = sorted(ocr_bboxes); ocr_bboxes = bbox_merge(ocr_bboxes)"
    // "ocr_bboxes = split_conflict(ocr_bboxes, latex_bboxes)"
    textBBoxes = sortBoxes(textBBoxes);
    textBBoxes = bboxMerge(textBBoxes);
    textBBoxes = splitConflict(textBBoxes, latexBBoxes);

    // Filter out non-text (if splitConflict changed labels or we have garbage)
    textBBoxes = textBBoxes.filter(b => b.label === "text");

    // 5. Slice Images
    const textSlices = await sliceFromImage(imageBlob, textBBoxes);
    const latexSlices = await sliceFromImage(imageBlob, latexBBoxes);

    // 6. Recognize Text
    // Run Text Rec Model on each slice
    const textContents = await this.recognizeText(textSlices);
    textBBoxes.forEach((b, i) => b.content = textContents[i]);

    // 7. Recognize Latex
    // Run Latex Rec Model (Formula Rec) on each slice
    // We can use the existing 'infer' method of InferenceEngine, but we need batching or sequential
    const latexContents = [];
    for (const slice of latexSlices) {
      const res = await this.latexRecEngine.infer(slice, options, signal);
      latexContents.push(res.latex);
    }
    latexBBoxes.forEach((b, i) => b.content = latexContents[i]);

    // 8. Combine & Format
    const resultMarkdown = this.combineResults(textBBoxes, latexBBoxes);

    return {
      markdown: resultMarkdown
    };
  }

  private async detectLatex(image: Blob): Promise<BBox[]> {
    if (!this.latexDetSession) {
      console.warn("Latex Detection session not ready, using mock.");
      return [];
    }

    try {
      const { tensor, inputWidth, inputHeight, originalWidth, originalHeight } = await preprocessYolo(image);

      const feeds: Record<string, import("onnxruntime-web").Tensor> = {};
      // YOLOv8 input name is usually 'images'. Check model metadata if possible, or assume standard.
      // If unknown, we can use session.inputNames[0]
      const inputName = this.latexDetSession.inputNames[0];
      feeds[inputName] = tensor;

      const results = await this.latexDetSession.run(feeds);

      const outputName = this.latexDetSession.outputNames[0];
      const output = results[outputName];

      // Output shape: [1, 5+C, 8400]
      return yoloPostprocess(
        output.data as Float32Array,
        output.dims as number[],
        0.25, // Conf Threshold
        originalWidth,
        originalHeight,
        inputWidth,
        inputHeight
      );

    } catch (e) {
      console.error("Detection Failed", e);
      return [];
    }
  }

  private async detectText(image: Blob): Promise<BBox[]> {
    if (!this.textDetSession) {
      console.warn("Text Detection session not ready, assuming whole image.");
      // Fallback or empty
      return [];
    }

    try {
      const { tensor, inputWidth, inputHeight, originalWidth, originalHeight } = await preprocessDBNet(image);

      const feeds: Record<string, import("onnxruntime-web").Tensor> = {};
      const inputName = this.textDetSession.inputNames[0];
      feeds[inputName] = tensor;

      const results = await this.textDetSession.run(feeds);
      const outputName = this.textDetSession.outputNames[0];
      const output = results[outputName];

      // Output dims: [1, 1, H, W] or [1, H, W] depending on model export
      // DBNet usually outputs probability map

      return dbnetPostprocess(
        output.data as Float32Array,
        output.dims[output.dims.length - 1], // Width
        output.dims[output.dims.length - 2], // Height
        0.3,
        originalWidth,
        originalHeight,
        inputWidth,
        inputHeight
      );
    } catch (e) {
      console.error("Text Detection Failed", e);
      return [];
    }
  }

  private async recognizeText(images: Blob[]): Promise<string[]> {
    if (!this.textRecModel || !this.textRecTokenizer) {
      return images.map(() => "Rec Model Not Loaded");
    }

    const results: string[] = [];

    // Batching? For now sequential to save memory
    for (const image of images) {
      try {
        const tensor = await preprocessTrOCR(image);

        // Generate
        const outputTokenIds = await this.textRecModel.generate({
          inputs: tensor,
          max_new_tokens: 20, // Short text lines
          num_beams: 1,
          do_sample: false
        } as any) as Tensor;

        const decoded = this.textRecTokenizer.batch_decode(outputTokenIds, {
          skip_special_tokens: true
        });

        results.push(decoded[0].trim());

        tensor.dispose();
        // outputTokenIds?.dispose(); // If tensor
      } catch (e) {
        console.error("Text Rec Error", e);
        results.push("[Error]");
      }
    }
    return results;
  }

  private combineResults(textBBoxes: BBox[], latexBBoxes: BBox[]): string {
    // Logic from paragraph2md
    // 1. Format Latex content (add $ signs)
    latexBBoxes.forEach(b => {
      // Heuristic: if label is "embedding" (inline) -> $...$
      // if "isolated" -> $$...$$
      // managing this distinction requires the detector to provide labels.
      // Default to isolated $$ for safety if unknown? 
      // TexTeller source: "embedding" vs "isolated".
      // We'll assume isolated for now unless detected.
      const content = b.content || "";
      b.content = ` $${content}$ `; // Simplify to inline for now or add logic
    });

    const allBoxes = [...textBBoxes, ...latexBBoxes];
    const sortedBoxes = sortBoxes(allBoxes);

    if (sortedBoxes.length === 0) return "";

    let md = "";
    let prev: BBox = { x: -1, y: -1, w: -1, h: -1, label: "guard" };

    for (const curr of sortedBoxes) {
      // Logic for adding spaces / newlines
      if (!this.isSameRow(prev, curr)) {
        md += "\n"; // New line
      } else {
        md += " ";
      }
      md += curr.content || "";
      prev = curr;
    }

    return md.trim();
  }

  private isSameRow(a: BBox, b: BBox, tolerance: number = 10): boolean {
    if (a.y === -1) return false; // Guard
    return Math.abs(a.y - b.y) < tolerance;
  }
}
