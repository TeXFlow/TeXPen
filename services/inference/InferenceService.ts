import { InferenceQueue, InferenceRequest } from "./utils/InferenceQueue";
import { MODEL_CONFIG } from "./config";
import {
  InferenceOptions,
  InferenceResult,
  ParagraphInferenceResult,
  SamplingOptions,
} from "./types";

export class InferenceService {
  private static instance: InferenceService;

  private worker: Worker | null = null;
  private queue: InferenceQueue;
  private currentModelId: string = MODEL_CONFIG.ID;
  private isLoading: boolean = false;

  // Map requestId -> {resolve, reject, onProgress}
  private pendingRequests = new Map<string, {
    resolve: (data: unknown) => void;
    reject: (err: unknown) => void;
    onProgress?: (status: string, progress?: number) => void;
    onPreprocess?: (debugImage: string) => void;
  }>();

  private constructor() {
    this.queue = new InferenceQueue((req, signal) => this.runInference(req, signal));
  }

  public static getInstance(): InferenceService {
    if (!InferenceService.instance) {
      InferenceService.instance = new InferenceService();
    }
    return InferenceService.instance;
  }

  private initWorker() {
    if (!this.worker) {
      // Create worker
      this.worker = new Worker(new URL('./InferenceWorker.ts', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (e) => {
        const { type, id, data, error } = e.data;

        const request = this.pendingRequests.get(id);
        if (!request) return;

        if (type === 'success') {
          request.resolve(data);
          this.pendingRequests.delete(id);
        } else if (type === 'error') {
          request.reject(new Error(error));
          this.pendingRequests.delete(id);
        } else if (type === 'progress') {
          if (request.onProgress) {
            request.onProgress(data.status, data.progress);
          }
        } else if (type === 'debug_image') {
          if (request.onPreprocess) {
            request.onPreprocess(data);
          }
        }
      };

      this.worker.onerror = (e) => {
        console.error("Worker error:", e);
      };
    }
  }

  public async init(
    onProgress?: (status: string, progress?: number) => void,
    options: InferenceOptions = {}
  ): Promise<void> {
    this.initWorker();

    // We can use a mutex or just rely on queue/worker serialization.
    // For init, we want to await it.

    const id = crypto.randomUUID();

    // Allow progress reporting
    return new Promise<void>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, onProgress });
      this.worker!.postMessage({
        type: 'init',
        id,
        data: options
      });
    });
  }

  public async infer(
    imageBlob: Blob,
    options: SamplingOptions
  ): Promise<InferenceResult> {
    // Default to num_beams=1 if not specified and not sampling
    if (!options.num_beams && !options.do_sample) {
      options.num_beams = 1;
    }
    return this.queue.infer(imageBlob, options, 'standard') as Promise<InferenceResult>;
  }

  public async inferParagraph(
    imageBlob: Blob,
    options: SamplingOptions
  ): Promise<ParagraphInferenceResult> {
    return this.queue.infer(imageBlob, options, 'paragraph') as Promise<ParagraphInferenceResult>;
  }

  private async runInference(
    req: InferenceRequest,
    signal: AbortSignal
  ): Promise<void> {
    this.initWorker();

    const id = crypto.randomUUID();
    let isAborted = false;

    return new Promise<void>((resolve) => {
      const cleanupSignal = () => {
        signal.removeEventListener('abort', onAbort);
      };

      const onAbort = () => {
        isAborted = true;
        cleanupSignal();
        // Reject the request immediately so the UI can respond
        req.reject(new Error("Aborted"));
        // Note: We do NOT call resolve() here. 
        // We wait for the worker to respond to this ID before resolving,
        // which ensures the next request in the queue doesn't start
        // until the worker is actually free.
      };

      if (signal.aborted) {
        onAbort();
        // Even if aborted, we must ensure we don't leave the queue hanging.
        // But if it was aborted BEFORE we sent it, we can resolve immediately.
        resolve();
        return;
      }

      signal.addEventListener('abort', onAbort);

      // Register the ID so we can resolve when worker replies
      this.pendingRequests.set(id, {
        resolve: (data) => {
          this.pendingRequests.delete(id);
          cleanupSignal();
          if (!isAborted) {
            req.resolve(data as any);
          }
          resolve(); // Resolve the processor promise to let queue move on
        },
        reject: (err) => {
          this.pendingRequests.delete(id);
          cleanupSignal();
          if (!isAborted) {
            req.reject(err);
          }
          resolve(); // Resolve the processor promise to let queue move on
        },
        onPreprocess: req.options.onPreprocess,
      });

      const { onPreprocess, ...workerOptions } = req.options;

      const workerData = {
        blob: req.blob,
        options: workerOptions,
        debug: !!onPreprocess
      };

      const msgType = req.type === 'paragraph' ? 'inferParagraph' : 'infer';

      this.worker!.postMessage({
        type: msgType,
        id,
        data: workerData
      });
    });
  }

  public async dispose(force: boolean = false): Promise<void> {
    if (!this.worker) return;

    const id = crypto.randomUUID();

    return new Promise<void>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker!.postMessage({
        type: 'dispose',
        id,
        data: { force }
      });
    }).then(() => {
      this.worker!.terminate();
      this.worker = null;
      this.pendingRequests.clear();
    });
  }

  public disposeSync(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Global Singleton
declare global {
  interface Window {
    __texpen_inference_service__?: InferenceService;
  }
}

function getOrCreateInstance(): InferenceService {
  if (typeof window !== "undefined") {
    if (!window.__texpen_inference_service__) {
      window.__texpen_inference_service__ = new (InferenceService as unknown as new () => InferenceService)();
    }
    return window.__texpen_inference_service__;
  }
  return InferenceService.getInstance();
}

export const inferenceService = getOrCreateInstance();

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    getOrCreateInstance().disposeSync();
  });
}

if ((import.meta as unknown as { hot: { dispose: (cb: () => void) => void } }).hot) {
  (import.meta as unknown as { hot: { dispose: (cb: () => void) => void } }).hot.dispose(() => {
    getOrCreateInstance().dispose(true);
  });
}
