import { useRef, useCallback, useState } from 'react';
import { Stroke } from '../types/canvas';

const MAX_HISTORY = 50;

interface HistoryItem {
  image: ImageData;
  strokes: Stroke[];
}

export const useCanvasHistory = () => {
  const historyRef = useRef<HistoryItem[]>([]);
  const historyIndexRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateState = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const saveSnapshot = useCallback((canvas: HTMLCanvasElement, strokes: Stroke[]) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Get raw image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Remove any redo states
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);

    // Add new state
    historyRef.current.push({
      image: imageData,
      strokes: [...strokes] // Create a copy of the strokes array
    });

    // Limit history size
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }

    updateState();
  }, [updateState]);

  const undo = useCallback((canvas: HTMLCanvasElement): Stroke[] | null => {
    if (historyIndexRef.current <= 0) return null;

    historyIndexRef.current--;
    const historyItem = historyRef.current[historyIndexRef.current];

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !historyItem) return null;

    ctx.putImageData(historyItem.image, 0, 0);
    updateState();

    return historyItem.strokes;
  }, [updateState]);

  const redo = useCallback((canvas: HTMLCanvasElement): Stroke[] | null => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return null;

    historyIndexRef.current++;
    const historyItem = historyRef.current[historyIndexRef.current];

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !historyItem) return null;

    ctx.putImageData(historyItem.image, 0, 0);
    updateState();

    return historyItem.strokes;
  }, [updateState]);

  const clear = useCallback(() => {
    historyRef.current = [];
    historyIndexRef.current = -1;
    updateState();
  }, [updateState]);

  return {
    saveSnapshot,
    undo,
    redo,
    clear,
    canUndo,
    canRedo
  };
};
