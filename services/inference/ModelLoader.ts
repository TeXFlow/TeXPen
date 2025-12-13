

import { AutoModelForVision2Seq } from '@huggingface/transformers';
import { VisionEncoderDecoderModel } from './types';
import { getSessionOptions, MODEL_CONFIG, SessionConfig } from './config';

export class ModelLoader {
  private static instance: ModelLoader;

  private constructor() { }

  public static getInstance(): ModelLoader {
    if (!ModelLoader.instance) {
      ModelLoader.instance = new ModelLoader();
    }
    return ModelLoader.instance;
  }

  public async preDownloadModels(modelId: string, sessionOptions: SessionConfig, onProgress?: (status: string, progress?: number) => void): Promise<void> {
    const { downloadManager } = await import('../downloader/DownloadManager');
    const commonFiles = [
      `onnx/${sessionOptions.encoder_model_file_name}`,
      `onnx/${sessionOptions.decoder_model_file_name}`,
    ];

    // State for tracking progress across multiple files
    const progressState: Record<string, { loaded: number, total: number }> = {};

    // Initialize state
    commonFiles.forEach(f => {
      progressState[f] = { loaded: 0, total: 0 };
    });

    const toMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);

    const updateProgress = () => {
      if (!onProgress) return;

      let totalLoaded = 0;
      let totalSize = 0;
      const parts: string[] = [];

      Object.entries(progressState).forEach(([f, s]) => {
        totalLoaded += s.loaded;
        totalSize += s.total;

        // Identify file type
        const name = f.includes('encoder') ? 'Enc' : (f.includes('decoder') ? 'Dec' : 'File');
        const loadedMB = toMB(s.loaded);
        const totalMB = toMB(s.total);

        if (s.total > 0) {
          const pct = Math.round((s.loaded / s.total) * 100);
          parts.push(`${name}: ${loadedMB}/${totalMB} MB (${pct}%)`);
        } else {
          parts.push(`${name}: ${loadedMB} MB`);
        }
      });

      if (totalSize === 0) return;

      // Calculate total percentage for the progress bar width
      const totalPercentage = Math.round((totalLoaded / totalSize) * 100);

      // Pass the detailed string as the status text
      onProgress(`${parts.join(' | ')}`, totalPercentage);
    };

    if (onProgress) onProgress(`Loading models...`, 0);

    const runDownload = async (file: string) => {
      const fileUrl = `https://huggingface.co/${modelId}/resolve/main/${file}`;
      // Do not catch errors here; let Promise.all fail so we stop the loading process
      await downloadManager.downloadFile(fileUrl, (p) => {
        progressState[file] = { loaded: p.loaded, total: p.total };
        updateProgress();
      });
    };

    // Use Promise.all to allow parallel downloads, controlled by DownloadManager (max 2)
    // This allows better saturation of bandwidth on desktop while DownloadManager protects mobile
    await Promise.all(commonFiles.map(file => runDownload(file)));
  }

  public async loadModelWithFallback(
    modelId: string,
    initialDevice: string,
    _onProgress?: (status: string, progress?: number) => void
  ): Promise<{ model: VisionEncoderDecoderModel, device: string }> {
    const device = initialDevice;
    const sessionOptions = getSessionOptions(device);

    try {
      const model = await AutoModelForVision2Seq.from_pretrained(modelId, sessionOptions as unknown as Record<string, unknown>) as unknown as VisionEncoderDecoderModel;
      return { model, device };
    } catch (err: unknown) {
      const loadError = err as Error;
      // Check if this is a WebGPU buffer size / memory error OR generic unsupported device error (common in Node env)
      const isWebGPUMemoryError = loadError?.message?.includes('createBuffer') ||
        loadError?.message?.includes('mappedAtCreation') ||
        loadError?.message?.includes('too large for the implementation') ||
        loadError?.message?.includes('GPUDevice');

      const isUnsupportedDeviceError = loadError?.message?.includes('Unsupported device');

      const isSessionError = loadError?.message?.includes('Failed to create the session') ||
        loadError?.message?.includes('Validation Error') ||
        loadError?.message?.includes('context') ||
        loadError?.message?.includes('adapter');

      // We want to fallback if ANY significant error happens during WebGPU init, 
      // as long as we are trying to use WebGPU.
      // The original code was throwing if isWebGPUMemoryError was true (Wait, looking at original code:
      // if ((...) && device === WEBGPU) { console.error...; throw loadError; } else { throw loadError; }
      // It was ALWAYS throwing. It never returned the fallback!

      if ((isWebGPUMemoryError || isUnsupportedDeviceError || isSessionError) && device === MODEL_CONFIG.PROVIDERS.WEBGPU) {
        console.warn('[ModelLoader] WebGPU error encountered, falling back to WASM:', loadError.message);

        // Fallback to WASM
        const wasmOptions = getSessionOptions(MODEL_CONFIG.PROVIDERS.WASM);
        const model = await AutoModelForVision2Seq.from_pretrained(modelId, wasmOptions as unknown as Record<string, unknown>) as unknown as VisionEncoderDecoderModel;
        return { model, device: MODEL_CONFIG.PROVIDERS.WASM };
      } else {
        throw loadError;
      }
    }
  }

  public async validateModelFiles(modelId: string, sessionOptions: SessionConfig): Promise<string[]> {
    const { downloadManager } = await import('../downloader/DownloadManager');
    const commonFiles = [
      `onnx/${sessionOptions.encoder_model_file_name}`,
      `onnx/${sessionOptions.decoder_model_file_name}`,
    ];

    const corruptedUrls: string[] = [];

    for (const file of commonFiles) {
      const fileUrl = `https://huggingface.co/${modelId}/resolve/main/${file}`;
      const fileName = file.split('/').pop() as keyof typeof MODEL_CONFIG.CHECKSUMS;
      const expectedChecksum = MODEL_CONFIG.CHECKSUMS[fileName];

      try {
        const result = await downloadManager.checkCacheIntegrity(fileUrl, expectedChecksum);
        if (!result.ok) {
          // Both missing and corrupted files need to be re-downloaded
          console.warn(`[ModelLoader] File ${result.missing ? 'missing' : 'corrupted'}: ${file}${result.reason ? ` - ${result.reason}` : ''}`);
          corruptedUrls.push(fileUrl);
        }
      } catch (e) {
        console.error(`[ModelLoader] Failed to check integrity for ${file}:`, e);
      }
    }

    return corruptedUrls;
  }
}

export const modelLoader = ModelLoader.getInstance();

