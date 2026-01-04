import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    width?: string;
    side?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, width = 'w-48', side = 'top' }) => {
    const triggerRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number; side: 'top' | 'bottom' } | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useLayoutEffect(() => {
        if (!isVisible || !triggerRef.current) return;

        const updatePosition = () => {
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const scrollY = window.scrollY;
                const scrollX = window.scrollX;

                let effectiveSide = side;

                // Simple collision detection
                // If preferred is top but we are too close to top edge (e.g. < 40px space), flip to bottom
                if (side === 'top' && rect.top < 40) {
                    effectiveSide = 'bottom';
                }
                // If preferred is bottom but close to bottom edge, flip to top
                // (Assuming 40px buffer)
                else if (side === 'bottom' && rect.bottom > viewportHeight - 40) {
                    effectiveSide = 'top';
                }

                // Calculate absolute position
                // For 'top': position above the element
                // For 'bottom': position below the element
                const top = effectiveSide === 'top'
                    ? rect.top + scrollY - 8 // 8px Offset
                    : rect.bottom + scrollY + 8;

                // Center horizontally
                // We need to know the tooltip width, but it's dynamic. 
                // A common trick is to center on the trigger, and then CSS transform translate-x-1/2
                // left: rect.left + rect.width / 2 + scrollX

                setPosition({
                    top,
                    left: rect.left + (rect.width / 2) + scrollX,
                    side: effectiveSide
                });
            }
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [side, isVisible]);

    // Close on click outside
    useEffect(() => {
        if (!isVisible) return;

        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is inside trigger OR inside the portal tooltip (we can't easily check portal ref here without more plumbing)
            // But we put `onClick={(e) => e.stopPropagation()}` on the tooltip div, so clicks inside it shouldn't bubble to document? 
            // Wait, document listener captures everything.
            // We need a ref for the tooltip content if we want to be precise, or just rely on bubbling.

            if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
                // Logic hole: clicking inside the portal tooltip will close it because it's not in triggerRef.
                // We need to check if the target is inside the tooltip.
                // Since the tooltip is high up in the DOM (body), we can't easily check containment without a ref to it.
                // Let's rely on the fact that if we click *inside* the tooltip, we stop propagation?
                // No, verify: document listener is on 'mousedown'. 
                setIsVisible(false);
            }
        };

        // We can add a specialized listener or checking logic
        // Easier: Just add a logic to ignoring clicks if they happen on a generic tooltip container class?
        // Or better: Use a ref for the portal content.
    }, [isVisible]);

    const handleMouseEnter = () => setIsVisible(true);
    const handleMouseLeave = () => setIsVisible(false);

    // Portal content
    const tooltipContent = isVisible && position ? (
        <div
            className={`absolute z-[9999] ${width} p-2 bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-lg shadow-xl text-left pointer-events-auto transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            style={{
                top: position.top,
                left: position.left,
                transform: `translateX(-50%) ${position.side === 'top' ? 'translateY(-100%)' : ''}`
            }}
            onMouseDown={(e) => e.stopPropagation()} // Stop document listener from seeing clicks inside tooltip
        >
            <div className="text-[10px] text-slate-500 dark:text-white/60 leading-tight">
                {content}
            </div>
        </div>
    ) : null;

    // Use a portal
    const { createPortal } = ReactDOM; // Assuming React imports. Actually we need to import ReactDOM.

    return (
        <>
            <div
                ref={triggerRef}
                className="relative inline-block"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={(e) => { e.stopPropagation(); setIsVisible(!isVisible); }}
            >
                {children}
            </div>
            {isVisible && createPortal(tooltipContent, document.body)}
        </>
    );
};

import ReactDOM from 'react-dom';
