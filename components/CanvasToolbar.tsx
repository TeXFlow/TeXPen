import React from 'react';
import { ToolType } from '../types/canvas';

interface CanvasToolbarProps {
    activeTool: ToolType;
    onToolChange: (tool: ToolType) => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

const PenIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
);

const EraserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L20 20Z" /><path d="M17 17L7 7" /></svg>
);

const LineEraserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L20 20Z" /><line x1="17" y1="17" x2="7" y2="7" /><line x1="12" y1="12" x2="22" y2="2" /></svg>
);

const UndoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
);

const RedoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
);

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    activeTool,
    onToolChange,
    onUndo,
    onRedo,
    canUndo,
    canRedo
}) => {
    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-sm border border-black/5 dark:border-white/10 rounded-full shadow-lg z-20">
            <div className="flex items-center gap-1 pr-2 border-r border-black/5 dark:border-white/10">
                <button
                    onClick={() => onToolChange('pen')}
                    className={`p-2 rounded-full transition-all ${activeTool === 'pen'
                        ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                        : 'text-slate-500 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                    title="Pen"
                >
                    <PenIcon />
                </button>
                <button
                    onClick={() => onToolChange('eraser-radial')}
                    className={`p-2 rounded-full transition-all ${activeTool === 'eraser-radial'
                        ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                        : 'text-slate-500 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                    title="Radial Eraser"
                >
                    <EraserIcon />
                </button>
                <button
                    onClick={() => onToolChange('eraser-line')}
                    className={`p-2 rounded-full transition-all ${activeTool === 'eraser-line'
                        ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                        : 'text-slate-500 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                    title="Line Eraser"
                >
                    <LineEraserIcon />
                </button>
            </div>

            <div className="flex items-center gap-1 pl-1">
                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className={`p-2 rounded-full transition-all ${!canUndo
                        ? 'text-slate-300 dark:text-white/10 cursor-not-allowed'
                        : 'text-slate-500 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    title="Undo"
                >
                    <UndoIcon />
                </button>
                <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className={`p-2 rounded-full transition-all ${!canRedo
                        ? 'text-slate-300 dark:text-white/10 cursor-not-allowed'
                        : 'text-slate-500 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    title="Redo"
                >
                    <RedoIcon />
                </button>
            </div>
        </div>
    );
};

export default CanvasToolbar;
