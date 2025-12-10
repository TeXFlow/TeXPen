// @vitest-environment jsdom
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Tooltip } from '../../../components/common/Tooltip';

describe('Tooltip', () => {
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

    beforeEach(() => {
        // Mock window dimensions
        Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });

        // Default mock implementation - element in middle of screen
        Element.prototype.getBoundingClientRect = vi.fn(() => ({
            top: 400,
            bottom: 420,
            left: 100,
            right: 200,
            width: 100,
            height: 20,
            x: 100,
            y: 400,
            toJSON: () => { }
        })) as unknown as () => DOMRect;
    });

    afterEach(() => {
        Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    });

    it('renders children and content', () => {
        render(
            <Tooltip content="Tooltip Content">
                <button>Trigger</button>
            </Tooltip>
        );
        expect(screen.getByText('Trigger')).toBeInTheDocument();
        expect(screen.getByText('Tooltip Content')).toBeInTheDocument();
    });

    it('positions content at top by default (or when side="top")', () => {
        render(
            <Tooltip content="Content" side="top">
                <button>Trigger</button>
            </Tooltip>
        );

        const tooltipContainer = screen.getByText('Content').closest('.absolute');
        // Default is top, which uses 'bottom-full' class (positioned at bottom of tooltip, i.e., above trigger)
        expect(tooltipContainer?.className).toContain('bottom-full');
    });

    it('positions content at bottom when requested', () => {
        render(
            <Tooltip content="Content" side="bottom">
                <button>Trigger</button>
            </Tooltip>
        );

        const tooltipContainer = screen.getByText('Content').closest('.absolute');
        expect(tooltipContainer?.className).toContain('top-full');
    });

    it('flips to bottom if top placement goes off-screen', () => {
        // Simulate element at the very top of screen (top: 0)
        // This means there is NO space above it.
        Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
            // If checking the parent/trigger
            if (this.classList.contains('group/tooltip')) {
                return { top: -10, bottom: 10, left: 10, right: 100, height: 20, width: 90, x: 10, y: -10 } as DOMRect;
            }
            // For tooltip content (simplified)
            return { top: 0, bottom: 20, left: 0, right: 100, height: 20, width: 100, x: 0, y: 0 } as DOMRect;
        }) as unknown as () => DOMRect;

        render(
            <Tooltip content="Flipping Content" side="top">
                <button>Trigger</button>
            </Tooltip>
        );

        // We expect the component to detect that 'top' is bad (0 < 0 or close to 0) and flip to 'bottom'
        const tooltipContainer = screen.getByText('Flipping Content').closest('.absolute');

        // Should have 'top-full' (which places it at the bottom of the trigger) instead of 'bottom-full'
        // This is the CRITICAL test that will fail before implementation
        expect(tooltipContainer?.className).toContain('top-full');
        expect(tooltipContainer?.className).not.toContain('bottom-full');
    });
});
