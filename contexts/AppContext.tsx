import React, { createContext, useContext, useState, useEffect } from 'react';
import { ModelConfig, Candidate, HistoryItem } from '../types';
import { useInkModel } from '../hooks/useInkModel';
import { useThemeContext } from './ThemeContext';
import { isWebGPUAvailable } from '../utils/env';
import { INFERENCE_CONFIG } from '../services/inference/config';

type Provider = 'webgpu' | 'wasm' | 'webgl';

export interface AppContextType {
    // InkModel
    config: ModelConfig;
    setConfig: (config: ModelConfig) => void;
    status: string;
    latex: string;
    setLatex: (latex: string) => void;
    candidates: Candidate[];
    infer: (canvas: HTMLCanvasElement) => Promise<{ latex: string; candidates: Candidate[] } | null>;
    inferFromUrl: (url: string) => Promise<{ latex: string; candidates: Candidate[] } | null>;
    clearModel: () => void;
    loadingPhase: string;
    isInferencing: boolean;
    debugImage: string | null;
    numCandidates: number;
    setNumCandidates: (n: number) => void;
    quantization: string;
    setQuantization: (q: string) => void;
    provider: Provider;
    setProvider: (p: Provider) => void;
    progress: number;
    userConfirmed: boolean;
    setUserConfirmed: (confirmed: boolean) => void;

    // Custom Model
    customModelId: string;
    setCustomModelId: (id: string) => void;

    isLoadedFromCache: boolean;
    showVisualDebugger: boolean;
    setShowVisualDebugger: (show: boolean) => void;

    // Sidebar
    isSidebarOpen: boolean;
    toggleSidebar: () => void;

    // Selected Candidate
    selectedIndex: number;
    setSelectedIndex: (index: number) => void;
    selectCandidate: (index: number) => void;

    // History Actions
    loadFromHistory: (item: HistoryItem) => void;

    // Tab Interface
    activeTab: 'draw' | 'upload';
    setActiveTab: (tab: 'draw' | 'upload') => void;

    // Session
    sessionId: string;
    refreshSession: () => void;

    // Upload State
    uploadPreview: string | null;
    showUploadResult: boolean;
    setUploadPreview: (url: string | null) => void;
    setShowUploadResult: (show: boolean) => void;

    // Inference State
    activeInferenceTab?: 'draw' | 'upload' | null;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { theme } = useThemeContext();
    const [quantization, setQuantization] = useState<string>(INFERENCE_CONFIG.DEFAULT_QUANTIZATION);
    const [provider, setProvider] = useState<Provider>(INFERENCE_CONFIG.DEFAULT_PROVIDER as Provider);
    const [customModelId, setCustomModelId] = useState<string>(INFERENCE_CONFIG.MODEL_ID);
    const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('draw');

    useEffect(() => {
        isWebGPUAvailable().then(available => {
            if (available) {
                setProvider('webgpu');
            }
        });
    }, []);

    const {
        config,
        setConfig,
        status,
        infer: modelInfer,
        inferFromUrl: modelInferFromUrl,
        loadingPhase,
        isInferencing,
        numCandidates,
        setNumCandidates,
        progress,
        userConfirmed,
        setUserConfirmed,
        isLoadedFromCache,
    } = useInkModel(theme, quantization, provider, customModelId);

    // --- State Management for Separate Tabs ---
    interface TabState {
        latex: string;
        candidates: Candidate[];
        selectedIndex: number;
        debugImage: string | null;
        // Upload specific
        uploadPreview: string | null;
        showUploadResult: boolean;
    }

    const initialTabState: TabState = {
        latex: '',
        candidates: [],
        selectedIndex: 0,
        debugImage: null,
        uploadPreview: null,
        showUploadResult: false
    };

    const [drawState, setDrawState] = useState<TabState>(initialTabState);
    const [uploadState, setUploadState] = useState<TabState>(initialTabState);

    // Helpers to get current active state
    const currentState = activeTab === 'draw' ? drawState : uploadState;
    const setCurrentState = activeTab === 'draw' ? setDrawState : setUploadState;

    // derived values for context consumers
    const latex = currentState.latex;
    const candidates = currentState.candidates;
    const selectedIndex = currentState.selectedIndex;
    const debugImage = currentState.debugImage;

    // Upload specific getters (always from uploadState to ensure persistence access even if tab switching?)
    // Actually, Main.tsx only renders Upload UI when activeTab === 'upload'.
    // But good to be explicitly reading from uploadState for clarity if we export them as `uploadPreview`.
    // However, to keep the interface simple, I'll export `uploadPreview` from `uploadState`.
    const uploadPreview = uploadState.uploadPreview;
    const showUploadResult = uploadState.showUploadResult;

    const setLatex = (val: string) => {
        setCurrentState(prev => ({ ...prev, latex: val }));
    };

    const setSelectedIndex = (val: number) => {
        setCurrentState(prev => ({ ...prev, selectedIndex: val }));
    };

    const selectCandidate = (index: number) => {
        setCurrentState(prev => ({
            ...prev,
            selectedIndex: index,
            latex: prev.candidates[index]?.latex || ''
        }));
    };

    // Setters for upload state
    const setUploadPreview = (url: string | null) => {
        setUploadState(prev => ({ ...prev, uploadPreview: url }));
    };

    const setShowUploadResult = (show: boolean) => {
        setUploadState(prev => ({ ...prev, showUploadResult: show }));
    };

    const clearModel = () => {
        setCurrentState(initialTabState);
    };

    // Track which tab is performing inference
    const [activeInferenceTab, setActiveInferenceTab] = useState<'draw' | 'upload' | null>(null);

    // Wrappers for inference to update the correct state
    const infer = async (canvas: HTMLCanvasElement) => {
        setActiveInferenceTab('draw');
        try {
            // Typically called from 'draw' tab
            const result = await modelInfer(canvas);
            if (result) {
                setDrawState(prev => ({
                    ...prev,
                    latex: result.latex,
                    candidates: result.candidates,
                    selectedIndex: 0,
                    debugImage: result.debugImage
                }));
                return result;
            }
            return null;
        } finally {
            setActiveInferenceTab(null);
        }
    };

    const inferFromUrl = async (url: string) => {
        setActiveInferenceTab('upload');
        try {
            // Typically called from 'upload' tab
            const result = await modelInferFromUrl(url);
            if (result) {
                setUploadState(prev => ({
                    ...prev,
                    latex: result.latex,
                    candidates: result.candidates,
                    selectedIndex: 0,
                    debugImage: result.debugImage
                }));
                return result;
            }
            return null;
        } finally {
            setActiveInferenceTab(null);
        }
    };


    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showVisualDebugger, setShowVisualDebugger] = useState(false);
    const [sessionId, setSessionId] = useState<string>(Date.now().toString());

    // Refresh session on clear or load
    const refreshSession = () => {
        setSessionId(Date.now().toString());
    };

    const loadFromHistory = (item: HistoryItem) => {
        // Loading from history always goes to Draw tab as per original/standard behavior, 
        // OR we could respect source. 
        // Main.tsx handles switching logic, here we just set state.
        // Let's reset Draw state to this item
        setDrawState({
            latex: item.latex,
            candidates: [], // History doesn't typically save candidates? If it does, we'd load them.
            selectedIndex: 0,
            debugImage: null,
            uploadPreview: null,
            showUploadResult: false
        });
        setActiveTab('draw');
        // Start a new session when loading from history (branching)
        refreshSession();
    };

    const toggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
    };

    const value: AppContextType = {
        // InkModel
        config,
        setConfig,
        status,
        latex,
        setLatex,
        candidates,
        infer,
        inferFromUrl,
        clearModel,
        loadingPhase,
        isInferencing,
        debugImage,
        numCandidates,
        setNumCandidates,
        quantization,
        setQuantization,
        provider,
        setProvider,
        progress,
        userConfirmed,
        setUserConfirmed,
        customModelId,
        setCustomModelId,
        isLoadedFromCache,
        showVisualDebugger,
        setShowVisualDebugger,

        // Sidebar
        isSidebarOpen,
        toggleSidebar,

        // Selected Candidate
        selectedIndex,
        setSelectedIndex,
        selectCandidate,

        // History
        loadFromHistory,

        // Tab
        activeTab,
        setActiveTab,

        // Session
        sessionId,
        refreshSession,

        // Upload State
        uploadPreview,
        showUploadResult,
        setUploadPreview,
        setShowUploadResult,

        // Inference State
        activeInferenceTab,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};