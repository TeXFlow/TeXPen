import React from 'react';

export const PenIcon: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Rotating Pen Group */}
            <g className="origin-center transform transition-transform duration-500 group-hover:-rotate-45">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
            </g>
            {/* Stationary Ink Trace (Arc of the tip movement) */}
            <path
                d="M 2 2 A 14.14 14.14 0 0 0 -2.14 12"
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                strokeWidth="2"
            />
        </svg>
    );
};
