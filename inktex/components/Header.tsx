import React, { useState } from 'react';
import { ModelConfig } from '../types';

interface HeaderProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  config: ModelConfig;
  setConfig: React.Dispatch<React.SetStateAction<ModelConfig>>;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ theme, toggleTheme, config, setConfig, isSidebarOpen, toggleSidebar }) => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="h-14 flex-none flex items-center justify-between px-4 border-b border-black/5 dark:border-white/5 bg-white/40 dark:bg-black/20 select-none z-30 backdrop-blur-md">
      {/* Left: Sidebar Toggle & Logo */}
      <div className="flex items-center gap-4">
        <button 
            onClick={toggleSidebar}
            className="p-2 rounded-lg text-slate-500 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white transition-all"
            title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
        >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isSidebarOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
            </svg>
        </button>

        <div className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 dark:from-cyan-500/10 dark:to-blue-600/10 border border-black/10 dark:border-white/10 flex items-center justify-center group-hover:border-cyan-500/40 transition-colors">
                <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white/90">InkTeX</h1>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-4">
        
        {/* Runtime Group */}
        <div className="hidden md:flex items-center p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
            <div className="flex items-center">
                {(['wasm', 'webgl', 'webgpu'] as const).map((p) => (
                <button 
                key={p}
                onClick={() => setConfig(prev => ({...prev, preferredProvider: p}))}
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-[8px] transition-all ${config.preferredProvider === p ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/50'}`}
                >
                    {p}
                </button>
                ))}
            </div>
            
            <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1"></div>

            <button 
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-white/20 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all relative"
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>

                {/* Info Popover */}
                {showInfo && (
                    <div className="absolute top-full right-0 mt-3 w-64 p-3 bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-xl shadow-2xl backdrop-blur-xl z-50 animate-fade-in text-left">
                        <h3 className="text-xs font-bold text-slate-800 dark:text-white mb-2 uppercase tracking-wide">Runtime Modes</h3>
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 w-12 shrink-0">WEBGPU</span>
                                <p className="text-[10px] text-slate-500 dark:text-white/60 leading-tight">Fastest. Uses modern GPU hardware acceleration. Recommended.</p>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 w-12 shrink-0">WEBGL</span>
                                <p className="text-[10px] text-slate-500 dark:text-white/60 leading-tight">Balanced. Standard GPU acceleration supported by most browsers.</p>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 w-12 shrink-0">WASM</span>
                                <p className="text-[10px] text-slate-500 dark:text-white/60 leading-tight">Fallback. Runs on CPU. Slower but works everywhere.</p>
                            </div>
                        </div>
                    </div>
                )}
            </button>
        </div>

        {/* Separator */}
        <div className="hidden md:block w-px h-6 bg-black/5 dark:bg-white/5"></div>

        {/* Theme Toggle */}
        <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-slate-500 dark:text-white/40 hover:text-amber-500 dark:hover:text-yellow-300 hover:bg-black/10 dark:hover:bg-white/10 transition-all shadow-sm"
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
            {theme === 'dark' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
            )}
        </button>

      </div>
    </div>
  );
};

export default Header;