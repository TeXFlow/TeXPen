import React from 'react';
import { useMathJax } from '../../hooks/useMathJax';

interface OutputDisplayProps {
    latex: string;
    markdown?: string;
    inferenceMode?: 'formula' | 'paragraph';
    isInferencing?: boolean;
    className?: string;
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({ latex, markdown, inferenceMode = 'formula', isInferencing = false, className }) => {
    // Trigger MathJax on latex change OR when inferencing ends (spinner hidden)
    useMathJax({ latex, isInferencing }, 'latex-output');

    const containerRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const [scale, setScale] = React.useState(1);

    // Scaling Logic
    React.useEffect(() => {
        const handleResize = () => {
            if (containerRef.current && contentRef.current && latex) {
                const containerWidth = containerRef.current.clientWidth;
                const containerHeight = containerRef.current.clientHeight;
                const contentWidth = contentRef.current.scrollWidth;
                const contentHeight = contentRef.current.scrollHeight;

                // Margins/Padding buffer
                // Dynamic safety buffer based on screen size (or just small constant)
                const marginBuffer = 0;

                const availableWidth = containerWidth - marginBuffer;
                const availableHeight = containerHeight - marginBuffer;

                let newScale = 1;

                // Only scale down if content exceeds bounds
                if (contentWidth > availableWidth || contentHeight > availableHeight) {
                    const scaleX = availableWidth / contentWidth;
                    const scaleY = availableHeight / contentHeight;
                    newScale = Math.min(scaleX, scaleY);
                }

                // Min scale limit to prevent illegibility
                newScale = Math.max(0.4, newScale);

                setScale(newScale);
            } else {
                setScale(1);
            }
        };

        // Run initially and on updates
        handleResize();

        // Observe resizing
        const resizeObserver = new ResizeObserver(handleResize);
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        if (contentRef.current) resizeObserver.observe(contentRef.current);

        return () => resizeObserver.disconnect();
    }, [latex, isInferencing]); // Re-run when latex changes

    const handleCopy = () => {
        const textToCopy = inferenceMode === 'paragraph' ? markdown : latex;
        if (textToCopy) navigator.clipboard.writeText(textToCopy);
    };

    const sanitizeLatex = (text: string) => {
        if (!text) return '';
        // Remove all instances of delimiters globally.
        const clean = text
            .replace(/\\\[/g, '')
            .replace(/\\\]/g, '')
            .replace(/\\\(/g, '')
            .replace(/\\\)/g, '')
            .replace(/\$\$/g, '')
            .replace(/^\$|\$$/g, '');
        return clean.trim();
    };

    return (
        <div ref={containerRef} className={`relative flex flex-col items-center justify-center z-10 overflow-hidden ${className || 'h-[30%] md:h-[35%]'}`}>
            <div className="w-full h-full flex items-center justify-center relative">
                <div
                    ref={contentRef}
                    id="latex-output"
                    className="text-center text-2xl md:text-5xl text-slate-800 dark:text-white px-4 md:px-8 py-4 leading-relaxed transition-transform duration-200 origin-center flex items-center justify-center whitespace-nowrap"
                    style={{ transform: `scale(${scale})` }}
                >
                    {isInferencing ? (
                        <div className="flex items-center justify-center gap-3 text-cyan-500 dark:text-cyan-400">
                            {/* Animated spinner */}
                            <div className="relative w-6 h-6">
                                <div className="absolute inset-0 border-2 border-cyan-500/30 dark:border-cyan-400/30 rounded-full"></div>
                                <div className="absolute inset-0 border-2 border-cyan-500 dark:border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <span className="font-medium text-lg animate-pulse">Generating {inferenceMode === 'paragraph' ? 'Text' : 'LaTeX'}...</span>
                        </div>
                    ) : inferenceMode === 'paragraph' ? (
                        markdown ? (
                            <div className="text-left text-lg md:text-xl text-slate-800 dark:text-gray-200 whitespace-pre-wrap font-mono max-w-4xl mx-auto">
                                {markdown}
                            </div>
                        ) : (
                            <span className="text-slate-200 dark:text-white/5 font-medium text-3xl tracking-tight select-none">Paragraph preview...</span>
                        )
                    ) : latex ? (
                        `\\[${sanitizeLatex(latex)}\\]`
                    ) : (
                        <span className="text-slate-200 dark:text-white/5 font-medium text-3xl tracking-tight select-none">Equation preview...</span>
                    )}
                </div>
            </div>

            {/* Action Bar */}
            <div className="absolute top-4 right-4 flex gap-2">
                <button
                    onClick={handleCopy}
                    disabled={inferenceMode === 'paragraph' ? !markdown : !latex}
                    className="p-2 text-slate-400 dark:text-white/30 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-0"
                    title="Copy LaTeX"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default OutputDisplay;