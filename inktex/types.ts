export interface ModelConfig {
    modelUrl: string;
    vocabUrl: string;
    imageSize: number;
    inputName: string;
    outputName: string;
    mean: number;
    std: number;
    invert: boolean;
    eosToken: string;
    preferredProvider: 'webgpu' | 'webgl' | 'wasm';
  }
  
  export interface Candidate {
    id: number;
    latex: string;
  }

  export interface HistoryItem {
    id: string;
    latex: string;
    timestamp: number;
  }
  
export type ModelStatus = 'loading' | 'ready' | 'error' | 'inferencing';

// Extend Window for MathJax and ONNX
declare global {
    interface Window {
      MathJax: any;
      ort: any;
      transformers?: any;
    }
  }
