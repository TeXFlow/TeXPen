import React, { useRef, useEffect } from 'react';

// Scalable Math Item Component
const MathHistoryItem: React.FC<{ latex: string }> = ({ latex }) => {
    const ref = useRef<HTMLDivElement>(null);
    const parentRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = React.useState(1);

    // Clean LaTeX
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
            ref.current.innerHTML = `\\(${cleanLatex}\\)`;
            window.MathJax.typesetPromise([ref.current]).then(() => {
                checkResize();
            }).catch((err: Error) => console.error('MathJax error:', err));
        }
    }, [cleanLatex]);

    const checkResize = () => {
        if (ref.current && parentRef.current) {
            const contentWidth = ref.current.scrollWidth;
            const containerWidth = parentRef.current.clientWidth;

            // Add padding buffer (Gradient is w-8 = 32px, plus some extra safety)
            const availableWidth = containerWidth - 40;

            if (contentWidth > availableWidth) {
                const newScale = Math.max(0.6, availableWidth / contentWidth);
                setScale(newScale);
            } else {
                setScale(1);
            }
        }
    };

    // Re-check on simple resize (sidebar toggle can affect this, so maybe ResizeObserver is better)
    useEffect(() => {
        const handleResize = () => requestAnimationFrame(checkResize);
        window.addEventListener('resize', handleResize);

        // Also observe parent size changes
        const observer = new ResizeObserver(handleResize);
        if (parentRef.current) observer.observe(parentRef.current);

        return () => {
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        };
    }, []);

    return (
        <div ref={parentRef} className="relative min-h-8 h-auto py-2 flex items-center w-full group/item">
            <div
                ref={ref}
                className="text-xs text-slate-700 dark:text-white/80 font-mono w-full whitespace-nowrap transition-transform origin-left"
                style={{ transform: `scale(${scale})`, width: 'fit-content' }}
            >
                {`\\(${cleanLatex}\\)`}
            </div>
        </div>
    );
};

export default MathHistoryItem;
