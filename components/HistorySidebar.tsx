import React from 'react';
import { useMathJax } from '../hooks/useMathJax';
import { HistoryItem } from '../types';
import { TrashIcon, CheckIcon, XIcon } from './icons/HistoryIcons';
import { useHistorySidebar } from '../hooks/useHistorySidebar';
import { useAppContext } from './contexts/AppContext';

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
    const { toggleSidebar } = useAppContext();
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
            className={`flex-none flex flex-col border-r border-black/5 dark:border-white/5 bg-white dark:bg-[#0c0c0c] transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-16'}`}
        >
            {/* Header with Toggle */}
            <div className="flex-none h-16 flex items-center border-b border-black/5 dark:border-white/5 overflow-hidden">
                {/* Toggle Button (Always visible, fixed width) */}
                <div className="flex-none w-16 h-16 flex items-center justify-center">
                    <button
                        onClick={toggleSidebar}
                        className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-white/40 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all"
                        title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v5h5" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l4 2" />
                        </svg>
                    </button>
                </div>

                {/* Title (Hidden when closed) */}
                <div className={`flex-1 flex justify-between items-center pr-4 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                    <>
                        <span className="text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider">History</span>
                        <span className="text-[10px] text-slate-400 dark:text-white/20">{history.length}</span>
                    </>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2 custom-scrollbar">
                {isOpen ? (
                    history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 px-4 text-center">
                            <span className="text-xs text-slate-400 dark:text-white/20 italic">No history yet.</span>
                        </div>
                    ) : (
                        history.map((item) => {
                            const isConfirming = confirmDeleteId === item.id;
                            return (
                                <div
                                    key={item.id}
                                    className="group relative p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] border border-transparent hover:border-black/5 dark:hover:border-white/5 transition-all cursor-pointer"
                                    onClick={() => onSelect(item)}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] items-center font-mono text-slate-400 dark:text-white/30">
                                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {!isConfirming && (
                                            <button
                                                onClick={(e) => handleDeleteClick(e, item.id)}
                                                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 rounded transition-all"
                                            >
                                                <TrashIcon />
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative h-8 flex items-center overflow-hidden">
                                        <div className="text-xs text-slate-700 dark:text-white/80 font-mono truncate w-full history-math">
                                            {sanitizeLatex(item.latex)}
                                        </div>
                                        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-[#0c0c0c] to-transparent pointer-events-none" />
                                    </div>

                                    {/* Confirmation Overlay */}
                                    {isConfirming && (
                                        <div className="absolute inset-0 z-10 bg-white/90 dark:bg-black/90 backdrop-blur-sm flex items-center justify-center gap-2 rounded-xl animate-in fade-in duration-200">
                                            <button
                                                onClick={(e) => handleConfirm(e, item.id)}
                                                className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm"
                                                title="Confirm Delete"
                                            >
                                                <CheckIcon />
                                            </button>
                                            <button
                                                onClick={handleCancel}
                                                className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                                                title="Cancel"
                                            >
                                                <XIcon />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )
                ) : null}
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