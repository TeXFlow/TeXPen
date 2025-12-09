import React, { useEffect, useState } from 'react';
import Select, { StylesConfig } from 'react-select';
import { useThemeContext } from '../../contexts/ThemeContext';
import { isWebGPUAvailable } from '../../utils/env';

type Provider = 'webgpu' | 'wasm';

interface ProviderSelectorProps {
    value: Provider;
    onChange: (value: Provider) => void;
}

const providerOptions: { value: Provider, label: string }[] = [
    { value: 'webgpu', label: 'WebGPU (Fastest)' },
    { value: 'wasm', label: 'WASM (Most Compatible, CPU)' },
];

export function ProviderSelector({ value, onChange }: ProviderSelectorProps) {
    const { theme } = useThemeContext();
    const [availableProviders, setAvailableProviders] = useState(providerOptions);

    useEffect(() => {
        isWebGPUAvailable().then(available => {
            if (!available) {
                setAvailableProviders(providerOptions.filter(p => p.value !== 'webgpu'));
            }
        });
    }, []);


    const selectedOption = availableProviders.find(option => option.value === value);

    const customStyles: StylesConfig = {
        control: (provided) => ({
            ...provided,
            width: 'auto',
            minWidth: '200px',
            backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            borderRadius: '0.5rem',
            boxShadow: 'none',
            cursor: 'pointer',
            padding: '2px 8px',
            minHeight: 'auto',
            display: 'flex',
            alignItems: 'center',
            '&:hover': {
                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
            },
        }),
        valueContainer: (provided) => ({
            ...provided,
            padding: '0 4px 0 0',
            margin: 0,
        }),
        input: (provided) => ({
            ...provided,
            margin: '0px',
            color: theme === 'dark' ? 'white' : 'black',
        }),
        indicatorSeparator: () => ({
            display: 'none',
        }),
        indicatorsContainer: (provided) => ({
            ...provided,
            height: 'auto',
            padding: 0,
        }),
        dropdownIndicator: (provided) => ({
            ...provided,
            padding: 0,
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
        }),
        singleValue: (provided) => ({
            ...provided,
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)',
            fontSize: '0.75rem',
            margin: 0,
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: theme === 'dark' ? '#1a1a1a' : 'white',
            border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            borderRadius: '0.75rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            zIndex: 50,
            overflow: 'hidden',
        }),
        option: (provided, { isSelected, isFocused }) => ({
            ...provided,
            backgroundColor: isSelected
                ? (theme === 'dark' ? 'rgb(6 182 212)' : 'rgb(6 182 212)')
                : isFocused
                    ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
                    : 'transparent',
            color: isSelected ? 'white' : (theme === 'dark' ? 'rgba(255, 255, 255, 0.8)' : '#1f2937'),
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: '8px 12px',
        }),
    };

    return (
        <Select
            value={selectedOption}
            onChange={(option: { value: Provider; label: string } | null) => onChange(option?.value || 'wasm')}
            options={availableProviders}
            isSearchable={false}
            styles={customStyles}
            placeholder="Select provider..."
        />
    );
}
