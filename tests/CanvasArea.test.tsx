// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CanvasArea from '../components/canvas/CanvasArea';
import { describe, it, expect, vi } from 'vitest';

// Mock CanvasBoard to ensure refs are passed back to CanvasArea
vi.mock('../components/canvas/CanvasBoard', () => ({
    default: ({ refCallback, contentRefCallback }: any) => {
        useEffect(() => {
            // Create mock canvas elements
            const mockCanvas = document.createElement('canvas');
            const mockContentCanvas = document.createElement('canvas');

            // Invoke callbacks to simulate component mounting
            refCallback(mockCanvas);
            contentRefCallback(mockContentCanvas);
        }, []);
        return <div>MockCanvasBoard</div>;
    }
}));

describe('CanvasArea', () => {
    it('calls onClear when Clear button is clicked', () => {
        const mockOnClear = vi.fn();
        const mockOnStrokeEnd = vi.fn();

        render(
            <CanvasArea
                theme="light"
                onClear={mockOnClear}
                onStrokeEnd={mockOnStrokeEnd}
            />
        );

        const clearBtn = screen.getByTitle('Clear Canvas');
        fireEvent.click(clearBtn);

        expect(mockOnClear).toHaveBeenCalled();
    });

    it('restores strokes when initialStrokes is provided', async () => {
        const mockOnClear = vi.fn();
        const mockOnStrokeEnd = vi.fn();

        const initialStrokes: any[] = [
            {
                tool: 'pen',
                color: '#000000',
                width: 2,
                points: [{ x: 0, y: 0 }, { x: 10, y: 10 }]
            }
        ];

        // Create mock context
        const mockCtx = {
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            stroke: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            drawImage: vi.fn(),
            lineCap: '',
            lineJoin: '',
            strokeStyle: '',
            lineWidth: 0,
            save: vi.fn(),
            restore: vi.fn(),
            resetTransform: vi.fn(),
        } as any;

        const originalCreateElement = document.createElement.bind(document);
        const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
            if (tagName === 'canvas') {
                const canvas = originalCreateElement(tagName, options) as HTMLCanvasElement;
                canvas.getContext = vi.fn(() => mockCtx);
                return canvas;
            }
            return originalCreateElement(tagName, options);
        });

        render(
            <CanvasArea
                theme="light"
                onClear={mockOnClear}
                onStrokeEnd={mockOnStrokeEnd}
                initialStrokes={initialStrokes}
            />
        );

        await waitFor(() => {
            expect(mockCtx.beginPath).toHaveBeenCalled();
            expect(mockCtx.stroke).toHaveBeenCalled();
        });

        vi.restoreAllMocks();
    });
});
