// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTabState } from '../../hooks/useTabState';

describe('useTabState', () => {
  it('preserves inferenceMode when clearing tab state', () => {
    const { result } = renderHook(() => useTabState('draw'));

    // Set to paragraph mode
    act(() => {
      result.current.setInferenceMode('paragraph');
    });
    expect(result.current.inferenceMode).toBe('paragraph');

    // Clear state
    act(() => {
      result.current.clearTabState();
    });

    // Should still be paragraph mode
    expect(result.current.inferenceMode).toBe('paragraph');
  });

  it('preserves inferenceMode when loading draw state', () => {
    const { result } = renderHook(() => useTabState('draw'));

    // Set to paragraph mode
    act(() => {
      result.current.setInferenceMode('paragraph');
    });
    expect(result.current.inferenceMode).toBe('paragraph');

    // Load state (e.g. from history)
    act(() => {
      result.current.loadDrawState('x^2', null);
    });

    // Should still be paragraph mode
    expect(result.current.inferenceMode).toBe('paragraph');
    expect(result.current.latex).toBe('x^2');
  });

  it('defaults to formula mode', () => {
    const { result } = renderHook(() => useTabState('draw'));
    expect(result.current.inferenceMode).toBe('formula');
  });
});
