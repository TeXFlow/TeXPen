import { useState } from 'react';
import { HistoryItem } from '../types';

export const useHistory = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const addToHistory = (item: HistoryItem) => {
    setHistory(prev => {
      // Deduplicate: Don't add if identical to the most recent item
      if (prev.length > 0 && prev[0].latex === item.latex) {
        return prev;
      }
      return [item, ...prev].slice(0, 20);
    });
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  return {
    history,
    addToHistory,
    deleteHistoryItem,
  };
};