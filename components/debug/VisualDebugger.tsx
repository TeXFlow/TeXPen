import React, { useState } from 'react';

interface VisualDebuggerProps {
    debugImage: string | null;
}

const VisualDebugger: React.FC<VisualDebuggerProps> = ({ debugImage }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!debugImage) return null;

    return (
        <div className="absolute bottom-4 left-4 z-50 flex flex-col items-start gap-2">
            <div
                className={`
                    bg-white/90 dark:bg-gray-900/90 backdrop-blur-md 
                    border border-gray-200 dark:border-gray-700 
                    rounded-lg shadow-xl overflow-hidden transition-all duration-300 ease-in-out
                    ${isExpanded ? 'w-64 p-3' : 'w-12 h-12 p-0 flex items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800'}
                `}
                onClick={() => !isExpanded && setIsExpanded(true)}
            >
                {isExpanded ? (
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Model Input</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsExpanded(false);
                                }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="relative aspect-square w-full bg-gray-100 dark:bg-black rounded border border-gray-200 dark:border-gray-800 overflow-hidden">
                            <img
                                src={debugImage}
                                alt="Debug Input"
                                className="w-full h-full object-contain"
                                style={{ imageRendering: 'pixelated' }}
                            />
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono text-center">
                            448x448 • Grayscale
                        </div>
                    </div>
                ) : (
                    <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                )}
            </div>
        </div>
    );
};

export default VisualDebugger;
