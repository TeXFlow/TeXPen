import React, { createContext, useContext } from 'react';
import { HistoryItem } from '../types';
import { useHistory } from '../hooks/useHistory';

interface HistoryContextType {
    history: HistoryItem[];
    addToHistory: (item: HistoryItem) => void;
    deleteHistoryItem: (id: string) => void;
    clearHistory: () => void;
    filterMode: 'all' | 'current';
    setFilterMode: (mode: 'all' | 'current') => void;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export const HistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { history, addToHistory, deleteHistoryItem, clearHistory } = useHistory();
    const [filterMode, setFilterMode] = React.useState<'all' | 'current'>('all');

    return (
        <HistoryContext.Provider value={{ history, addToHistory, deleteHistoryItem, clearHistory, filterMode, setFilterMode }}>
            {children}
        </HistoryContext.Provider>
    );
};

export const useHistoryContext = () => {
    const context = useContext(HistoryContext);
    if (!context) {
        throw new Error('useHistoryContext must be used within a HistoryProvider');
    }
    return context;
};
