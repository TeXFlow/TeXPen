import { useState } from 'react';
import { HistoryItem } from '../types';

export const useHistory = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const addToHistory = (item: HistoryItem) => {
    setHistory(prev => {
      // Smart Session Logic:
      // If the new item belongs to the same session as the most recent item,
      // we update the recent item instead of creating a new one.
      // This groups continuous strokes into a single history entry.
      if (prev.length > 0 && prev[0].sessionId === item.sessionId) {
        const updated = [...prev];
        updated[0] = item; // Update in-place
        return updated;
      }
      // Otherwise, it's a new session (or first item), so add it.
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