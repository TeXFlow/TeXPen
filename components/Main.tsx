import React from 'react';
import { useAppContext } from './contexts/AppContext';
import { useThemeContext } from './contexts/ThemeContext';
import { useHistoryContext } from './contexts/HistoryContext';
import LiquidBackground from './LiquidBackground';
import Header from './Header';
import HistorySidebar from './HistorySidebar';
import OutputDisplay from './OutputDisplay';
import Candidates from './Candidates';
import CanvasArea from './CanvasArea';
import LoadingOverlay from './LoadingOverlay';
import VisualDebugger from './VisualDebugger';

const Main: React.FC = () => {
    const {
        status,
        latex,
        candidates,
        infer,
        clearModel,
        progress,
        loadingPhase,
        userConfirmed,
        setUserConfirmed,
        isLoadedFromCache,
        loadFromHistory,
        isSidebarOpen,
        selectedIndex,
        selectCandidate,
        isInferencing,
        debugImage,
        showVisualDebugger,
    } = useAppContext();

    const { theme } = useThemeContext();
    const { history, addToHistory, deleteHistoryItem } = useHistoryContext();

    const handleInference = async (canvas: HTMLCanvasElement) => {
        const result = await infer(canvas);
        if (result) {
            addToHistory({ id: Date.now().toString(), latex: result.latex, timestamp: Date.now() });
        }
    };

    // Only show full overlay for initial model loading, not during inference
    const isInitialLoading = status === 'loading' && loadingPhase.includes('model');
    const showFullOverlay = isInitialLoading || status === 'error';

    return (
        <div className="relative h-screen w-screen overflow-hidden font-sans bg-[#fafafa] dark:bg-black transition-colors duration-500">
            <LiquidBackground />

            <div className="flex flex-col w-full h-full bg-white/60 dark:bg-[#0c0c0c]/80 backdrop-blur-md transition-colors duration-500">
                <Header />

                <div className="flex-1 flex min-h-0 relative">
                    <HistorySidebar
                        history={history}
                        onSelect={loadFromHistory}
                        onDelete={deleteHistoryItem}
                        isOpen={isSidebarOpen}
                    />

                    <div className="flex-1 flex flex-col min-w-0 z-10 relative">
                        <OutputDisplay latex={latex} isInferencing={isInferencing} />

                        <Candidates />

                        <CanvasArea
                            theme={theme}
                            onStrokeEnd={handleInference}
                            onClear={clearModel}
                        />

                        {/* <DebugTest
                            onTest={inferFromUrl}
                            status={status}
                        /> */}
                    </div>
                </div>
            </div>

            {/* Visual Debugger (shows preprocessed image when enabled) */}
            {showVisualDebugger && <VisualDebugger debugImage={debugImage} />}

            {/* Download Prompt */}
            {!userConfirmed && !isLoadedFromCache && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#111] p-6 rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 max-w-sm w-full text-center">
                        <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Download Model</h3>
                        <p className="text-sm text-slate-500 dark:text-white/60 mb-6">
                            The inference model (~300MB) needs to be downloaded to your browser. This only happens once.
                        </p>
                        <button
                            onClick={() => setUserConfirmed(true)}
                            className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-cyan-500/20"
                        >
                            Download Model
                        </button>
                    </div>
                </div>
            )}

            {/* Full overlay only for initial model loading or errors */}
            {showFullOverlay && (
                <LoadingOverlay />
            )}
        </div>
    );
};

export default Main;