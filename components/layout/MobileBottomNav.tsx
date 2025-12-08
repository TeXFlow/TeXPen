import React from 'react';
import { useAppContext } from '../../contexts/AppContext';

export const MobileBottomNav: React.FC = () => {
    const { activeTab, setActiveTab } = useAppContext();

    return (
        <div className="md:hidden flex-none h-16 bg-white/80 dark:bg-[#111]/80 backdrop-blur-md border-t border-black/5 dark:border-white/5 flex items-center justify-around px-2 z-30 pb-safe">
            <button
                onClick={() => setActiveTab('draw')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition-colors ${activeTab === 'draw'
                    ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/10'
                    : 'text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60'
                    }`}
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'draw' ? 2 : 1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span className="text-[10px] font-medium">Draw</span>
            </button>

            <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition-colors ${activeTab === 'upload'
                    ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/10'
                    : 'text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60'
                    }`}
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'upload' ? 2 : 1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-[10px] font-medium">Upload</span>
            </button>
        </div>
    );
};
