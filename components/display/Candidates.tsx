import React, { useEffect, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useHistoryContext } from '../../contexts/HistoryContext';


// Component to render a single candidate with MathJax
// Component to render a single candidate with MathJax
const MathCandidateBase: React.FC<{ latex: string }> = ({ latex }) => {
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

    const checkResize = React.useCallback(() => {
        if (ref.current && parentRef.current) {
            const contentWidth = ref.current.offsetWidth;
            const contentHeight = ref.current.offsetHeight;
            const containerWidth = parentRef.current.offsetWidth;
            const containerHeight = parentRef.current.offsetHeight;

            // Padding buffer
            const xPadding = 0;
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
    }, []);

    useEffect(() => {
        let isMounted = true;

        const renderMath = () => {
            if (!isMounted || !ref.current) return;

            if (window.MathJax && window.MathJax.typesetPromise) {
                // Clear previous content
                ref.current.innerHTML = `\\(${cleanLatex}\\)`;
                window.MathJax.typesetPromise([ref.current]).then(() => {
                    // Trigger resize check after typesetting
                    // Small delay to ensure layout is done
                    if (isMounted) setTimeout(checkResize, 10);
                }).catch((err: Error) => {
                    console.error('MathJax error:', err);
                    if (ref.current && isMounted) ref.current.textContent = cleanLatex;
                });
            } else {
                // Retry if MathJax isn't ready yet
                setTimeout(renderMath, 100);
            }
        };

        renderMath();

        return () => {
            isMounted = false;
        };
    }, [cleanLatex, checkResize]);

    // Re-check on window resize
    useEffect(() => {
        window.addEventListener('resize', checkResize);
        return () => window.removeEventListener('resize', checkResize);
    }, [checkResize]);

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

// Memoize to prevent re-renders when other UI state changes
const MathCandidate = React.memo(MathCandidateBase, (prev, next) => {
    return prev.latex === next.latex;
});

const Candidates: React.FC = () => {
    const {
        candidates,
        selectedIndex,
        selectCandidate,
        sessionId,
        activeTab,
    } = useAppContext();
    const { addToHistory } = useHistoryContext();

    const handleCandidateClick = (index: number) => {
        // Only save to history if selecting a different candidate
        if (index !== selectedIndex && candidates[index]) {
            const candidate = candidates[index];
            addToHistory({
                id: Date.now().toString(),
                latex: candidate.latex,
                timestamp: Date.now(),
                source: activeTab,
                sessionId,
            });
        }
        selectCandidate(index);
    };

    return (
        <div className="flex-none h-20 flex items-center relative z-20 transition-colors duration-500">
            <div className="w-full h-full overflow-x-auto flex items-center px-4 gap-4 no-scrollbar">

                {/* Only show candidates if they exist */}
                {candidates.map((cand, idx) => (
                    <button
                        key={`${idx}-${cand.latex}`}
                        onClick={() => handleCandidateClick(idx)}
                        className={`
                relative group flex-none h-12 px-4 rounded-xl text-lg transition-all duration-300 flex items-center justify-center overflow-hidden max-w-[240px] min-w-[64px]
                ${selectedIndex === idx
                                ? 'text-cyan-600 dark:text-cyan-400 scale-105'
                                : 'text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 hover:bg-black/5 dark:hover:bg-white/5'
                            }
              `}
                    >
                        <MathCandidate latex={cand.latex} />

                        {/* Active Indicator Dot - Minimal */}

                    </button>
                ))}
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