import { useState, useEffect, useCallback, useRef } from 'react';
import { ModelConfig, ModelStatus, Candidate } from '../types';
import { DEFAULT_CONFIG, initModel, runInference, generateVariations } from '../services/onnxService';

export const useInkModel = (theme: 'dark' | 'light') => {
  const [config, setConfig] = useState<ModelConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<ModelStatus>('loading');
  const [latex, setLatex] = useState<string>('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [loadLabel, setLoadLabel] = useState<string>('Preparing model…');

  // Initialize model on mount or when provider changes
  useEffect(() => {
    const load = async () => {
      setStatus('loading');
      setLoadProgress(0);
      setLoadLabel('Preparing model…');

      const pushProgress = (data: { progress?: number; loaded?: number; total?: number; file?: string; status?: string }) => {
        if (data.status === 'initiate' && data.file) {
          setLoadLabel(`Loading ${data.file}`);
        }

        let pct: number | undefined = undefined;
        if (typeof data.progress === 'number') {
          pct = data.progress;
        } else if (typeof data.loaded === 'number' && typeof data.total === 'number' && data.total > 0) {
          pct = (data.loaded / data.total) * 100;
        }

        if (pct !== undefined) {
          const newPct = Math.floor(pct);
          setLoadProgress(currentPct => (newPct > currentPct || newPct === 100) ? newPct : currentPct);
        }
      };

      try {
        await initModel(config, pushProgress);
        setStatus('ready');
        setLoadProgress(100);
        setLoadLabel('Ready');
      } catch (e) {
        setStatus('error');
        console.error(e);
      }
    };
    load();
  }, [config.preferredProvider, config.modelUrl]);

  const infer = useCallback(async (canvas: HTMLCanvasElement) => {
    if (status !== 'ready' && status !== 'inferencing') return null;
    
    setStatus('inferencing');
    try {
        const resultLatex = await runInference(canvas, config, theme);
        const vars = generateVariations(resultLatex);
        
        const newCandidates = vars.map((l, i) => ({ id: i, latex: l }));
        setCandidates(newCandidates);
        setLatex(vars[0]);
        setStatus('ready');
        
        return { latex: vars[0], candidates: newCandidates };
    } catch (e) {
        console.error(e);
        setStatus('error');
        return null;
    }
  }, [config, status, theme]);

  const clear = useCallback(() => {
    setLatex('');
    setCandidates([]);
  }, []);

  return {
    config,
    setConfig,
    status,
    loadProgress,
    loadLabel,
    latex,
    setLatex,
    candidates,
    setCandidates,
    infer,
    clear
  };
};
