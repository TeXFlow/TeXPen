import React, { useState } from 'react';
import Select, { StylesConfig } from 'react-select';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useAppContext } from '../../contexts/AppContext';
import { Quantization, PerformanceProfile, QUANTIZATION_OPTIONS, PROFILE_OPTIONS } from '../../services/inference/types';
import { Tooltip } from '../common/Tooltip';
import { HelpIcon } from '../common/HelpIcon';

import { MODEL_CONFIG } from '../../services/inference/config';

export function QuantizationSelector() {
    const { theme } = useThemeContext();
    const {
        performanceProfile,
        setPerformanceProfile,
        encoderQuantization,
        setEncoderQuantization,
        decoderQuantization,
        setDecoderQuantization,

        provider,
    } = useAppContext();

    const [isAdvanced, setIsAdvanced] = useState(false);

    const getSelectStyles = (isSubOption = false): StylesConfig => ({
        control: (provided) => ({
            ...provided,
            width: '100%',
            backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            borderRadius: '0.5rem',
            boxShadow: 'none',
            cursor: 'pointer',
            padding: '2px 8px',
            minHeight: '38px',
            fontSize: isSubOption ? '0.8rem' : '0.9rem',
            '&:hover': {
                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
            },
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: theme === 'dark' ? '#1a1a1a' : 'white',
            border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            borderRadius: '0.5rem',
            zIndex: 100,
        }),
        option: (provided, { isSelected, isFocused }) => ({
            ...provided,
            backgroundColor: isSelected
                ? 'rgb(6 182 212)'
                : isFocused
                    ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
                    : 'transparent',
            color: isSelected
                ? 'white'
                : (theme === 'dark' ? 'rgba(255, 255, 255, 0.8)' : '#1f2937'),
            cursor: 'pointer',
            fontSize: '0.85rem',
        }),
        singleValue: (provided) => ({
            ...provided,
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
        }),
        input: (provided) => ({
            ...provided,
            color: theme === 'dark' ? 'white' : 'black',
        }),
        indicatorSeparator: () => ({
            display: 'none',
        }),
    });

    const handleProfileChange = (val: PerformanceProfile) => {
        setPerformanceProfile(val);
        // The AppProvider effect will update the individual quantizations
    };

    const handleManualChange = (type: 'encoder' | 'decoder', val: Quantization) => {
        if (type === 'encoder') {
            setEncoderQuantization(val);
        }
        if (type === 'decoder') {
            setDecoderQuantization(val);
        }
        // AppProvider now automatically switches to 'custom' profile when these are called
    };

    const selectedProfile = PROFILE_OPTIONS.find(p => p.value === performanceProfile);
    const selectedEncoder = QUANTIZATION_OPTIONS.find(q => q.value === encoderQuantization);
    const selectedDecoder = QUANTIZATION_OPTIONS.find(q => q.value === decoderQuantization);

    // Calculate estimated size
    const getEncoderSize = (q: Quantization) => {
        switch (q) {
            case 'fp32': return MODEL_CONFIG.FILE_SIZES['encoder_model.onnx'];
            case 'fp16': return MODEL_CONFIG.FILE_SIZES['encoder_model_fp16.onnx'];
            case 'int8': return MODEL_CONFIG.FILE_SIZES['encoder_model_int8.onnx'];
            case 'int4': return MODEL_CONFIG.FILE_SIZES['encoder_model_int4.onnx'];
            default: return 0;
        }
    };

    const getDecoderSize = (q: Quantization) => {
        switch (q) {
            case 'fp32': return MODEL_CONFIG.FILE_SIZES['decoder_model_merged.onnx']; // Defaulting to merged
            case 'fp16': return MODEL_CONFIG.FILE_SIZES['decoder_model_merged.onnx']; // FP16 uses FP32 decoder in this config map usually
            case 'int8': return MODEL_CONFIG.FILE_SIZES['decoder_model_merged_int8.onnx'];
            case 'int4': return MODEL_CONFIG.FILE_SIZES['decoder_model_merged_int4.onnx'];
            default: return 0;
        }
    };

    const totalSize = (
        getEncoderSize(encoderQuantization) +
        getDecoderSize(decoderQuantization)
    );
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(0);

    return (
        <div className="flex flex-col gap-3">
            {/* Main Profile Selector */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                        <div className="text-xs font-bold uppercase text-slate-400 dark:text-white/40">Performance Profile</div>
                        <Tooltip content="Select a preset for the best balance of quality and speed.">
                            <HelpIcon />
                        </Tooltip>
                    </div>
                </div>
                <Select
                    value={selectedProfile}
                    onChange={(opt) => opt && handleProfileChange((opt as { value: PerformanceProfile }).value)}
                    options={PROFILE_OPTIONS.filter(p => {
                        if (provider === 'wasm') {
                            // CPU (WASM): Hide 'fast' (FP16 encoder) as it's slow on CPU
                            return p.value !== 'fast';
                        } else {
                            // GPU (WebGPU): Hide 'balanced' (Int8) and 'low_memory' (Int4) if they are not supported/performant
                            return p.value !== 'balanced' && p.value !== 'low_memory';
                        }
                    })}
                    styles={getSelectStyles()}
                    isSearchable={false}
                    formatOptionLabel={(option: unknown) => {
                        const opt = option as { label: string; description?: string };
                        return (
                            <div className="flex flex-col gap-0.5">
                                <span className="font-medium">{opt.label}</span>
                                {opt.description && (
                                    <span className="text-[10px] opacity-60">{opt.description}</span>
                                )}
                            </div>
                        );
                    }}
                />

                {/* Size Estimate */}
                <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-slate-400 dark:text-white/30">
                        Est. Download: ~{totalSizeMB} MB
                    </span>
                </div>
            </div>

            {/* Advanced Toggle */}
            <div>
                <button
                    onClick={() => setIsAdvanced(!isAdvanced)}
                    className="flex items-center gap-2 text-xs text-cyan-600 dark:text-cyan-400 font-medium hover:underline focus:outline-none"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className={`w-3 h-3 transition-transform ${isAdvanced ? 'rotate-90' : ''}`}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                    Advanced Settings
                </button>
            </div>

            {/* Advanced Controls */}
            {isAdvanced && (
                <div className="flex flex-col gap-3 pl-3 border-l-2 border-slate-100 dark:border-white/5 animate-in slide-in-from-top-2 duration-200">

                    {/* Information Box */}
                    <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-600 dark:text-blue-300">
                        <p className="font-semibold mb-0.5">Note:</p>
                        The FP16 decoder has been removed as it is slower than FP32.
                    </div>

                    {/* Encoder */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-white/40">Encoder</span>
                        <Select
                            value={selectedEncoder}
                            onChange={(opt) => opt && handleManualChange('encoder', (opt as { value: Quantization }).value)}
                            options={QUANTIZATION_OPTIONS.filter(q => {
                                if (provider === 'wasm') {
                                    return q.value !== 'fp16';
                                } else {
                                    return q.value !== 'int8' && q.value !== 'int4';
                                }
                            })}
                            styles={getSelectStyles(true)}
                            isSearchable={false}
                        />
                    </div>

                    {/* Decoder */}
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-white/40">Decoder</span>
                        </div>
                        <Select
                            value={selectedDecoder}
                            options={QUANTIZATION_OPTIONS.filter(o => {
                                if (o.value === 'fp16') return false;
                                if (provider === 'webgpu') {
                                    return o.value !== 'int8' && o.value !== 'int4';
                                }
                                return true;
                            })}
                            onChange={(opt) => opt && handleManualChange('decoder', (opt as { value: Quantization }).value)}
                            styles={getSelectStyles(true)}
                            isSearchable={false}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
