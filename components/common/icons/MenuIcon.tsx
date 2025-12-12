import React from 'react';

export const MenuIcon: React.FC<{ isOpen: boolean; className?: string }> = ({ isOpen, className = "w-5 h-5" }) => {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {isOpen ? (
                <>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-3 3 3 3" />
                </>
            ) : (
                <>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 9l3 3-3 3" />
                </>
            )}
        </svg>
    );
};
