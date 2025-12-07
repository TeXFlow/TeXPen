import React, { useEffect, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';


// Component to render a single candidate with MathJax
// Component to render a single candidate with MathJax
const MathCandidate: React.FC<{ latex: string }> = ({ latex }) => {
    const ref = useRef<HTMLSpanElement>(null);
    const parentRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = React.useState(1);

    // Clean LaTeX for rendering
    const cleanLatex = latex
        .replace(/\\\[/g, '')
        .replace(/\\\]/g, '')
        .replace(/\\\(/g, '')
        .replace(/\\\)/g, '')
        .replace(/\$\$/g, '')
        .replace(/^\$|\$$/g, '')
        .trim();

    useEffect(() => {
        if (ref.current && window.MathJax) {
            // Clear previous content
            ref.current.innerHTML = `\\(${cleanLatex}\\)`;
            window.MathJax.typesetPromise([ref.current]).then(() => {
                // Trigger resize check after typesetting
                // Small delay to ensure layout is done
                setTimeout(checkResize, 10);
            }).catch((err: Error) => {
                console.error('MathJax error:', err);
                if (ref.current) ref.current.textContent = cleanLatex;
            });
        }
    }, [cleanLatex]);

    const checkResize = () => {
        if (ref.current && parentRef.current) {
            const contentWidth = ref.current.offsetWidth;
            const contentHeight = ref.current.offsetHeight;
            const containerWidth = parentRef.current.offsetWidth;
            const containerHeight = parentRef.current.offsetHeight;

            // Padding buffer
            const xPadding = 12;
            const yPadding = 4;

            const availWidth = containerWidth - xPadding;
            const availHeight = containerHeight - yPadding;

            // Calculate scale to fit both dimensions
            const scaleX = availWidth / contentWidth;
            const scaleY = availHeight / contentHeight;

            // Use the smaller scale to ensure it fits entirely
            // Cap at 1.5 to prevent it from getting absurdly huge on empty space
            const newScale = Math.min(Math.min(scaleX, scaleY), 1.5);

            setScale(newScale);
        }
    };

    // Re-check on window resize
    useEffect(() => {
        window.addEventListener('resize', checkResize);
        return () => window.removeEventListener('resize', checkResize);
    }, []);

    return (
        <div ref={parentRef} className="w-full h-full flex items-center justify-center overflow-hidden">
            <span
                ref={ref}
                className="relative z-10 whitespace-nowrap transition-transform origin-center text-xl"
                style={{ transform: `scale(${scale})` }}
            >
                {cleanLatex}
            </span>
        </div>
    );
};

const Candidates: React.FC = () => {
    const {
        candidates,
        selectedIndex,
        selectCandidate,
        status,
    } = useAppContext();

    return (
        <div className="flex-none h-20 bg-white/40 dark:bg-[#0a0a0a] border-y border-black/5 dark:border-white/5 flex items-center relative z-20 backdrop-blur-sm transition-colors duration-500">
            <div className="w-full h-full overflow-x-auto flex items-center px-4 gap-2 no-scrollbar">

                {/* Status Handling */}
                {status === 'loading' ? (
                    <div className="flex items-center gap-3 text-slate-400 dark:text-white/30 text-xs font-mono">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                        </span>
                        <span className="tracking-wide animate-pulse">Initializing AI Model...</span>
                    </div>
                ) : status === 'inferencing' ? (
                    <div className="flex items-center gap-3 text-cyan-600 dark:text-cyan-400 text-xs font-mono">
                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="tracking-wide">Reading handwriting...</span>
                    </div>
                ) : status === 'error' ? (
                    <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400 text-xs font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <span>Model Error. Check console.</span>
                    </div>
                ) : candidates.length === 0 ? (
                    <div className="flex items-center gap-2 text-slate-400 dark:text-white/20 text-xs font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 dark:bg-emerald-400/50"></span>
                        <span className="tracking-wide">Write an equation...</span>
                    </div>
                ) : (
                    candidates.map((cand, idx) => (
                        <button
                            key={`${idx}-${cand.latex}`}
                            onClick={() => selectCandidate(idx)}
                            className={`
                relative group flex-none h-12 px-2 rounded-lg text-lg transition-all duration-200 border flex items-center justify-center overflow-hidden max-w-[240px]
                ${selectedIndex === idx
                                    ? 'bg-cyan-50/50 dark:bg-white/10 border-cyan-200 dark:border-white/20 text-cyan-700 dark:text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)] dark:shadow-[0_0_15px_rgba(103,232,249,0.15)]'
                                    : 'bg-transparent border-transparent text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
                                }
              `}
                        >
                            <MathCandidate latex={cand.latex} />

                            {/* Active Indicator Dot */}
                            {selectedIndex === idx && (
                                <span className="absolute -bottom-px left-1/2 -translate-x-1/2 w-4 h-px bg-cyan-500 dark:bg-cyan-400 shadow-[0_0_8px_cyan]"></span>
                            )}
                        </button>
                    ))
                )}
            </div>

            <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
        </div>
    );
};

export default Candidates;