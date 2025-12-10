// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LoadingOverlay from '../../../components/common/LoadingOverlay';
import { useAppContext } from '../../../contexts/AppContext';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../contexts/AppContext');

describe('LoadingOverlay', () => {
    const mockOpenSettings = vi.fn();
    const mockOnDismiss = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useAppContext as any).mockReturnValue({
            isInitialized: true,
            status: 'ready',
            userConfirmed: false,
            isLoadedFromCache: false,
            openSettings: mockOpenSettings,
            setUserConfirmed: vi.fn(),
            loadingPhase: 'idle',
            progress: 0,
        });
    });

    it('opens settings and focuses modelId when "Configure Manually" is clicked', () => {
        render(<LoadingOverlay isDismissed={false} onDismiss={mockOnDismiss} />);

        const configureBtn = screen.getByText('Configure Manually');
        fireEvent.click(configureBtn);

        expect(mockOnDismiss).toHaveBeenCalled();
        expect(mockOpenSettings).toHaveBeenCalledWith('modelId');
    });

    it('opens settings and focuses modelId when Close button is clicked', () => {
        render(<LoadingOverlay isDismissed={false} onDismiss={mockOnDismiss} />);

        const closeBtn = screen.getByTitle('Close and configure manually');
        fireEvent.click(closeBtn);

        expect(mockOnDismiss).toHaveBeenCalled();
        expect(mockOpenSettings).toHaveBeenCalledWith('modelId');
    });
});
