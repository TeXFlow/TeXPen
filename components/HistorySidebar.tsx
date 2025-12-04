import React from 'react';
import { useMathJax } from '../hooks/useMathJax';
import { HistoryItem } from '../types';
import { TrashIcon, CheckIcon, XIcon } from './icons/HistoryIcons';
import { useHistorySidebar } from '../hooks/useHistorySidebar';

interface HistorySidebarProps {
    history: HistoryItem[];
    onSelect: (item: HistoryItem) => void;
    onDelete: (id: string) => void;
    isOpen: boolean;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({
    history,
    onSelect,
    onDelete,
    isOpen,
}) => {
    const {
        confirmDeleteId,
        sanitizeLatex,
        handleDeleteClick,
        handleConfirm,
        handleCancel
    } = useHistorySidebar(onDelete);

    // Trigger MathJax when history updates
    useMathJax(history, undefined, 'history-math');

    return (
        <div
            className={`flex-none border-r border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-black/20 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 border-r-0'}`}
        >
            <div className="w-64 h-full flex flex-col">
                <div className="flex-none p-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center whitespace-nowrap">
                    <span className="text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider">History</span>
                    <span className="text-[10px] text-slate-400 dark:text-white/20">{history.length} items</span>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2 custom-scrollbar">
                    {history.length === 0 ? (
                        <div className="p-4 text-center whitespace-nowrap">
                            <p className="text-slate-400 dark:text-white/20 text-xs italic">No history yet.</p>
                        </div>
                    ) : (
                        history.map((item) => {
                            const isConfirming = confirmDeleteId === item.id;

                            return (
                                <div key={item.id} className="relative group rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => onSelect(item)}
                                        className="w-full text-left p-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-transparent hover:border-black/5 dark:hover:border-white/10 transition-all"
                                    >
                                        {/* Removed pr-6 since icon is now at bottom */}
                                        <div className="history-math text-slate-700 dark:text-white/80 text-sm truncate opacity-70 group-hover:opacity-100 h-6">
                                            {`\\( ${sanitizeLatex(item.latex)} \\)`}
                                        </div>
                                        <div className="mt-1 flex justify-between items-center">
                                            <span className="text-[10px] text-slate-400 dark:text-white/30 font-mono">
                                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </button>

                                    {/* Trash Icon - Moved to Bottom Right */}
                                    {!isConfirming && (
                                        <button
                                            onClick={(e) => handleDeleteClick(e, item.id)}
                                            className="absolute bottom-2 right-2 p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                                            title="Delete item"
                                        >
                                            <TrashIcon />
                                        </button>
                                    )}

                                    {/* Confirmation Overlay */}
                                    {isConfirming && (
                                        <div className="absolute inset-0 bg-red-50 dark:bg-red-900/90 backdrop-blur-sm z-20 flex items-center justify-between px-3 animate-in fade-in duration-200">
                                            <span className="text-xs font-semibold text-red-600 dark:text-red-200">Delete?</span>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={(e) => handleConfirm(e, item.id)}
                                                    className="p-1.5 rounded bg-red-600 text-white hover:bg-red-700 shadow-sm transition-colors"
                                                    title="Confirm"
                                                >
                                                    <CheckIcon />
                                                </button>
                                                <button
                                                    onClick={handleCancel}
                                                    className="p-1.5 rounded bg-white dark:bg-black/40 text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white border border-black/5 dark:border-white/10 transition-colors"
                                                    title="Cancel"
                                                >
                                                    <XIcon />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
      `}</style>
        </div>
    );
};

export default HistorySidebar;