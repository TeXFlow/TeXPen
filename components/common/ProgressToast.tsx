import React from 'react';

interface ProgressToastProps {
    phase: string;
    progress: number;
}

export const ProgressToast: React.FC<ProgressToastProps> = ({ phase, progress }) => {
    const parts = phase.split('|');
    const isMultiLine = parts.length > 1;

    return (
        <div className="absolute inset-x-0 bottom-8 z-30 flex justify-center pointer-events-none">
            <div className={`px-6 py-3 bg-white/90 dark:bg-[#111]/90 backdrop-blur-md border border-cyan-500/30 dark:border-cyan-400/30 ${isMultiLine ? 'rounded-2xl' : 'rounded-full'} flex items-center gap-3 shadow-xl pointer-events-auto animate-in slide-in-from-bottom-5 duration-300`}>
                <div className="relative w-4 h-4 flex-none self-center">
                    <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="flex flex-col text-sm font-medium text-slate-700 dark:text-white/90 text-center min-w-[200px]">
                    {parts.map((part, i) => (
                        <span key={i} className="whitespace-nowrap">
                            {part.trim()}
                            {/* Show global percentage on the last line if it exists */}
                            {i === parts.length - 1 && progress > 0 && ` (${Math.round(progress)}%)`}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};
