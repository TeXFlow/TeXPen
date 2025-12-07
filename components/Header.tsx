import React from 'react';
import { useAppContext } from './contexts/AppContext';
import { QuantizationSelector } from './QuantizationSelector';
import { ProviderSelector } from './ProviderSelector';

const Header: React.FC = () => {
    const {
        numCandidates,
        setNumCandidates,
        quantization,
        setQuantization,
        provider,
        setProvider,
        showVisualDebugger,
        setShowVisualDebugger,
    } = useAppContext();

    return (
        <div className="h-14 flex-none flex items-center justify-end px-6 border-b border-black/5 dark:border-white/5 bg-white/40 dark:bg-black/20 select-none z-30 backdrop-blur-md">
            {/* Right: Controls */}
            <div className="flex items-center gap-4">

                {/* Candidate Count Group */}
                <div className="hidden md:flex items-center p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-2 px-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-white/40">Candidates</span>
                        <input
                            type="number"
                            min="1"
                            max="5"
                            value={numCandidates}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) {
                                    setNumCandidates(Math.min(5, Math.max(1, val)));
                                }
                            }}
                            className="w-10 h-6 text-center text-xs font-mono bg-white dark:bg-white/10 rounded-md border border-black/10 dark:border-white/10 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 text-slate-700 dark:text-white"
                        />

                        <div className="relative group/info">
                            <svg className="w-3.5 h-3.5 text-slate-400 dark:text-white/30 cursor-help hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>

                            {/* Tooltip */}
                            <div className="absolute top-full right-0 mt-2 w-48 p-2 bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-lg shadow-xl backdrop-blur-xl z-50 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-200 text-left pointer-events-none">
                                <p className="text-[10px] text-slate-500 dark:text-white/60 leading-tight">
                                    <span className="font-bold text-cyan-600 dark:text-cyan-400">1 Candidate:</span> Fast (Greedy)<br />
                                    <span className="font-bold text-purple-600 dark:text-purple-400">2-5 Candidates:</span> Slower (Beam Search)
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Separator */}
                <div className="hidden md:block w-px h-6 bg-black/5 dark:bg-white/5"></div>

                {/* Provider Group */}
                <div className="hidden md:flex items-center p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-2 px-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-white/40">Provider</span>
                        <ProviderSelector
                            value={provider}
                            onChange={setProvider}
                        />
                    </div>
                </div>

                {/* Separator */}
                <div className="hidden md:block w-px h-6 bg-black/5 dark:bg-white/5"></div>


                {/* Quantization Group */}
                <div className="hidden md:flex items-center p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-2 px-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-white/40">Quantization</span>
                        <QuantizationSelector
                            value={quantization}
                            onChange={setQuantization}
                        />
                    </div>
                </div>

                {/* Separator */}
                <div className="hidden md:block w-px h-6 bg-black/5 dark:bg-white/5"></div>

                {/* Debug Toggle */}
                <button
                    onClick={() => setShowVisualDebugger(!showVisualDebugger)}
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all shadow-sm ${showVisualDebugger
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-600 dark:text-cyan-400'
                        : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 text-slate-500 dark:text-white/40 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-black/10 dark:hover:bg-white/10'
                        }`}
                    title={showVisualDebugger ? "Hide Visual Debugger" : "Show Visual Debugger"}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                </button>

            </div>
        </div>
    );
};

export default Header;
