import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    label?: string;
    isActive?: boolean;
    variant?: 'ghost' | 'pill';
    className?: string; // Allow overriding/adding classes if absolutely necessary
}

export const IconButton: React.FC<IconButtonProps> = ({
    icon,
    label,
    isActive = false,
    variant = 'pill',
    className = '',
    ...props
}) => {
    const baseStyles = "transition-all duration-300 flex items-center justify-center gap-2 font-semibold";

    let variantStyles = "";

    if (variant === 'pill') {
        variantStyles = isActive
            ? 'bg-white dark:bg-[#222] text-cyan-600 dark:text-cyan-400 shadow-sm px-4 py-1.5 rounded-full text-xs'
            : 'text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white px-4 py-1.5 rounded-full text-xs bg-transparent';
    } else if (variant === 'ghost') {
        // e.g., for toolbar icons or sidebar toggles
        variantStyles = 'p-2 text-slate-500 dark:text-white/40 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl';
    }

    return (
        <button
            className={`${baseStyles} ${variantStyles} ${className}`}
            {...props}
        >
            {icon}
            {label && <span>{label}</span>}
        </button>
    );
};
