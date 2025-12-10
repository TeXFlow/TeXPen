import React, { useRef, useState, useLayoutEffect } from 'react';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    width?: string;
    side?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, width = 'w-48', side = 'top' }) => {
    const triggerRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<'top' | 'bottom'>(side);

    useLayoutEffect(() => {
        const checkPosition = () => {
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                const viewportHeight = window.innerHeight;

                console.log('Tooltip Logic:', { side, rectTop: rect.top, rectBottom: rect.bottom, viewportHeight });

                // Simple collision detection
                // If preferred is top but we are too close to top edge (e.g. < 40px space), flip to bottom
                if (side === 'top' && rect.top < 40) {
                    console.log('Flipping to bottom');
                    setPosition('bottom');
                }
                // If preferred is bottom but close to bottom edge, flip to top
                // (Assuming 40px buffer)
                else if (side === 'bottom' && rect.bottom > viewportHeight - 40) {
                    console.log('Flipping to top');
                    setPosition('top');
                } else {
                    setPosition(side);
                }
            } else {
                console.log('No triggerRef');
            }
        };

        checkPosition();
        window.addEventListener('resize', checkPosition);
        window.addEventListener('scroll', checkPosition, true); // Capture scroll for better accuracy

        return () => {
            window.removeEventListener('resize', checkPosition);
            window.removeEventListener('scroll', checkPosition, true);
        };
    }, [side]);

    return (
        <div ref={triggerRef} className="relative group/tooltip">
            {children}

            <div className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} ${width} p-2 bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-lg shadow-xl z-[60] opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 text-left pointer-events-none -right-2 md:right-0 md:left-auto`}>
                <div className="text-[10px] text-slate-500 dark:text-white/60 leading-tight">
                    {content}
                </div>
            </div>
        </div>
    );
};
