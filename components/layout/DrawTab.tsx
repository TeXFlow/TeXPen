import React from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { Stroke } from '../../types/canvas';
import CanvasArea from '../canvas/CanvasArea';
import OutputDisplay from '../display/OutputDisplay';
import Candidates from '../display/Candidates';

interface DrawTabProps {
    onInference: (canvas: HTMLCanvasElement, strokes: Stroke[]) => Promise<void>;
    renderLoadingOverlay: () => React.ReactNode;
}

const DrawTab: React.FC<DrawTabProps> = ({
    onInference,
    renderLoadingOverlay
}) => {
    const {
        status,
        latex,
        clearModel,
        userConfirmed,
        activeInferenceTab,
        loadedStrokes,
        refreshSession,
        customNotification,
        inferenceMode,
        setInferenceMode,
        paragraphResult
    } = useAppContext();

    const { theme } = useThemeContext();


    const isDrawInferencing = activeInferenceTab === 'draw';

    const handleClear = () => {

        clearModel();
        refreshSession();
    };

    return (
        <>
            {/* Output Display Section */}
            <div className="flex-none h-1/4 md:h-2/5 flex flex-col w-full relative z-10 shrink-0">
                <OutputDisplay
                    latex={latex}
                    markdown={paragraphResult}
                    inferenceMode={inferenceMode}
                    isInferencing={isDrawInferencing}
                    className="flex-1 w-full"
                />
                {inferenceMode === 'formula' && <Candidates />}
            </div>

            {/* Mode Switcher */}
            <div className="flex justify-center py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                        onClick={() => setInferenceMode('formula')}
                        className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${inferenceMode === 'formula'
                                ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        Formula
                    </button>
                    <button
                        onClick={() => setInferenceMode('paragraph')}
                        className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${inferenceMode === 'paragraph'
                                ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        Paragraph
                    </button>
                </div>
            </div>

            {/* Canvas Workspace */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
                <div className="flex-1 flex flex-col absolute inset-0 z-10">
                    <CanvasArea
                        theme={theme}
                        onStrokeEnd={onInference}
                        initialStrokes={loadedStrokes}
                        onClear={handleClear}
                    />
                    {((status === 'loading' && userConfirmed) || !!customNotification) && renderLoadingOverlay()}
                </div>
            </div>
        </>
    );
};

export default DrawTab;
