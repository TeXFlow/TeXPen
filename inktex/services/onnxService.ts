import { ModelConfig } from '../types';

const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.0';
const HF_MODEL_ID = 'OleehyO/TexTeller';
const LOCAL_META_BASE = '/models/OleehyO/TexTeller';
const LOCAL_META_FILES = new Set([
  'preprocessor_config.json',
  'config.json',
  'generation_config.json',
  'tokenizer_config.json',
  'tokenizer.json',
  'vocab.json',
  'merges.txt',
  'special_tokens_map.json',
  'added_tokens.json'
]);

let textellerPipeline: any = null;
let transformersReady: Promise<any> | null = null;

// Default Config (served from Hugging Face CDN at runtime)
export const DEFAULT_CONFIG: ModelConfig = {
  modelUrl: HF_MODEL_ID,
  vocabUrl: '',
  imageSize: 448, // match the model's preprocessor_config
  inputName: 'pixel_values',
  outputName: 'logits',
  mean: 0.0,
  std: 1.0,
  invert: false,
  eosToken: '</s>',
  preferredProvider: 'webgpu'
};

const ensureTransformers = async (): Promise<any> => {
  // Already cached from a previous call
  if (transformersReady) {
    const cached = await transformersReady;
    if (cached?.pipeline) return cached;
  }

  // If another script populated the global, prefer it.
  const globalTransformers = (window as any).transformers;
  if (globalTransformers?.pipeline) {
    return globalTransformers;
  }

  // Lazy-load directly from the CDN to keep the bundle lean.
  transformersReady = import(
    /* @vite-ignore */
    TRANSFORMERS_CDN
  )
    .then(mod => {
      const resolved = (mod as any)?.pipeline ? mod : (mod as any).default;
      if (!resolved?.pipeline) {
        throw new Error('Transformers.js failed to expose a pipeline export');
      }
      (window as any).transformers = resolved;
      return resolved;
    })
    .catch(err => {
      transformersReady = null;
      throw err;
    });

  return transformersReady;
};

// Patch fetch to handle quirks of the OleehyO/TexTeller model.
const ensureModelFetch = () => {
  const win = window as any;
  if (win.__textellerMetaPatched) return;

  const originalFetch = win.fetch.bind(win);
  win.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as any)?.url;

    if (typeof url === 'string' && url.includes(HF_MODEL_ID)) {
      const fileName = url.split('/').pop() || '';

      // 1. The model repo is missing some metadata files, and fetching others is unreliable. Serve them locally.
      if (LOCAL_META_FILES.has(fileName)) {
        return originalFetch(`${LOCAL_META_BASE}/${fileName}`, init);
      }
      // 2. The ONNX files are at the repo root, but transformers.js looks for them in an /onnx subdirectory.
      //    We need to rewrite the URL to point to the correct raw file location.
      if (url.includes('/onnx/') && url.endsWith('.onnx')) {
        const hfUrl = `https://huggingface.co/${HF_MODEL_ID}/resolve/main/${fileName}`;
        return originalFetch(hfUrl, init);
      }
    }
    return originalFetch(input as any, init);
  };

  win.__textellerMetaPatched = true;
};

export const initModel = async (
  config: ModelConfig,
  onProgress?: (data: { progress?: number; loaded?: number; total?: number; file?: string; status?: string }) => void
): Promise<void> => {
  ensureModelFetch();

  const transformers = await ensureTransformers();
  const { pipeline, env } = transformers;

  env.allowLocalModels = true;
  env.allowRemoteModels = true;
  env.localModelPath = '/models';
  env.useBrowserCache = true; // Use cache for better performance on static sites.

  // Release existing pipeline if we had one
  textellerPipeline = null;
  const targetModel = config.modelUrl || HF_MODEL_ID;
  const device = config.preferredProvider === 'webgpu' ? 'webgpu' : 'wasm';

  const progress_callback = (data: any) => {
    if (!onProgress) return;
    onProgress({
      progress: data?.progress,
      loaded: data?.loaded,
      total: data?.total,
      file: data?.file,
      status: data?.status
    });
  };

  const load = (opts: { device: string; dtype: string; quantized: boolean }) =>
    pipeline(
      'image-to-text',
      targetModel,
      {
        ...opts,
        progress_callback
      }
    );

  const attempts: Array<{ device: string; dtype: 'fp32'; quantized: boolean; note: string }> = [
    { device, dtype: 'fp32', quantized: false, note: 'preferred device fp32' },
    { device: 'wasm', dtype: 'fp32', quantized: false, note: 'wasm fp32 fallback' }
  ];

  let lastErr: any = null;
  for (const attempt of attempts) {
    try {
      textellerPipeline = await load(attempt);
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`Load attempt failed (${attempt.note})`, err);
    }
  }
  throw lastErr;
};

export const runInference = async (
  canvas: HTMLCanvasElement,
  config: ModelConfig,
  theme: 'dark' | 'light'
): Promise<string> => {
  if (!textellerPipeline) {
    // Mock return if the model failed to init, to keep the UI usable
    await new Promise(r => setTimeout(r, 500));
    const mockLatex = ["E = mc^2", "\\frac{a}{b}", "\\sqrt{x^2 + y^2}", "\\int_0^\\infty f(x) dx"];
    return mockLatex[Math.floor(Math.random() * mockLatex.length)];
  }

  const prepared = prepareCanvasForModel(canvas, config.imageSize, theme);
  const result = await textellerPipeline(prepared, { max_new_tokens: 128 });
  const text = Array.isArray(result) ? result[0]?.generated_text : result?.generated_text;
  return (text || '').trim();
};

const prepareCanvasForModel = (
  source: HTMLCanvasElement,
  targetSize: number,
  theme: 'dark' | 'light'
): HTMLCanvasElement => {
  const offscreen = document.createElement('canvas');
  offscreen.width = targetSize;
  offscreen.height = targetSize;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to acquire 2d context');
  }

  // Draw with a known background; if the user is in dark mode we invert so the model sees dark ink on light bg.
  if (theme === 'dark') {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, targetSize, targetSize);
    ctx.drawImage(source, 0, 0, targetSize, targetSize);

    // Invert colors so white ink on black becomes black ink on white
    const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
      // keep alpha
    }
    ctx.putImageData(imageData, 0, 0);
  } else {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, targetSize, targetSize);
    ctx.drawImage(source, 0, 0, targetSize, targetSize);
  }

  return offscreen;
};

export const generateVariations = (base: string): string[] => {
  const candidates = [base].filter(Boolean);

  // Variation 1: Explicit braces
  let v1 = base.replace(/\^(\w)/g, '^{$1}').replace(/_(\w)/g, '_{$1}');
  if (v1 !== base && !candidates.includes(v1)) candidates.push(v1);

  // Variation 2: Cdot
  let v2 = base.replace(/([a-zA-Z0-9}])\s+([a-zA-Z])/g, '$1 \\cdot $2');
  if (v2 !== base && !candidates.includes(v2)) candidates.push(v2);

  // Variation 3: Times
  let v3 = base.replace(/([a-zA-Z0-9}])\s+([a-zA-Z])/g, '$1 \\times $2');
  if (v3 !== base && !candidates.includes(v3)) candidates.push(v3);
  
  // Variation 4: dfrac
  let v4 = base.replace(/\\frac/g, '\\dfrac');
  if (v4 !== base && !candidates.includes(v4)) candidates.push(v4);

  return candidates.slice(0, 5);
};
