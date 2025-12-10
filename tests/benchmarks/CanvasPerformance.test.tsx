/**
 * Canvas Performance Benchmark
 * 
 * This test simulates rapid drawing operations to measure
 * the performance of the CanvasBoard component.
 * 
 * Key metrics:
 * - Time to process N draw events
 * - Operations per second
 * 
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import CanvasBoard from '../../components/canvas/CanvasBoard';

describe('Canvas Performance Benchmark', () => {
    const NUM_DRAW_EVENTS = 500;

    let mockCtx: any;
    let originalCreateElement: typeof document.createElement;

    beforeAll(() => {
        originalCreateElement = document.createElement.bind(document);
        global.ResizeObserver = class ResizeObserver {
            observe() { }
            unobserve() { }
            disconnect() { }
        };
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        cleanup();
    });

    beforeEach(() => {
        vi.useFakeTimers();

        // Mock Canvas Context
        mockCtx = {
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn(),
            stroke: vi.fn(),
            strokeRect: vi.fn(),
            fill: vi.fn(),
            fillRect: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            scale: vi.fn(),
            resetTransform: vi.fn(),
            setLineDash: vi.fn(),
            drawImage: vi.fn(),
            globalCompositeOperation: 'source-over',
            lineCap: 'round',
            lineJoin: 'round',
            lineWidth: 1,
            strokeStyle: '#000000',
        };

        vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
            if (tagName === 'canvas') {
                // Use JSDOM canvas which has full DOM API needed by React
                const canvas = document.implementation.createHTMLDocument().createElement('canvas');

                canvas.getContext = vi.fn((type) => {
                    if (type === '2d') return mockCtx;
                    return null;
                }) as any;

                // Mock getBoundingClientRect for coordinate calculations
                canvas.getBoundingClientRect = () => ({
                    left: 0,
                    top: 0,
                    width: 500,
                    height: 500,
                    right: 500,
                    bottom: 500,
                    x: 0,
                    y: 0,
                    toJSON: () => { }
                });
                return canvas;
            }
            return originalCreateElement(tagName, options);
        });
    });

    it(`should process ${NUM_DRAW_EVENTS} draw events efficiently`, () => {
        const onStrokeEnd = vi.fn();
        const refCallback = vi.fn();
        const contentRefCallback = vi.fn();

        const { container } = render(
            <CanvasBoard
                theme="dark"
                activeTool="pen"
                onStrokeEnd={onStrokeEnd}
                refCallback={refCallback}
                contentRefCallback={contentRefCallback}
            />
        );

        const canvas = container.querySelector('canvas');
        expect(canvas).toBeTruthy();
        if (!canvas) return;

        // Start drawing
        fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });

        // Measure time for N draw events using real timers for accurate measurement
        vi.useRealTimers();
        const startTime = performance.now();

        for (let i = 0; i < NUM_DRAW_EVENTS; i++) {
            fireEvent.mouseMove(canvas, {
                clientX: 100 + i,
                clientY: 100 + Math.sin(i / 10) * 50
            });
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const eventsPerSecond = (NUM_DRAW_EVENTS / duration) * 1000;

        // Stop drawing
        fireEvent.mouseUp(canvas);

        console.log('\n=== Canvas Performance Benchmark Results ===');
        console.log(`Events processed: ${NUM_DRAW_EVENTS}`);
        console.log(`Total duration: ${duration.toFixed(2)}ms`);
        console.log(`Events per second: ${eventsPerSecond.toFixed(0)}`);
        console.log(`Average time per event: ${(duration / NUM_DRAW_EVENTS).toFixed(3)}ms`);
        console.log('============================================\n');

        // Performance assertion: 
        // For 60fps, we need to process each event in under ~16ms
        // With optimization, we expect much better than this
        expect(duration / NUM_DRAW_EVENTS).toBeLessThan(16);

        // We should be able to handle at least 1000 events/second
        expect(eventsPerSecond).toBeGreaterThan(1000);
    });

    it('should handle rapid tool changes without performance degradation', () => {
        const onStrokeEnd = vi.fn();
        const refCallback = vi.fn();
        const contentRefCallback = vi.fn();

        const { rerender, container } = render(
            <CanvasBoard
                theme="dark"
                activeTool="pen"
                onStrokeEnd={onStrokeEnd}
                refCallback={refCallback}
                contentRefCallback={contentRefCallback}
            />
        );

        const canvas = container.querySelector('canvas');
        expect(canvas).toBeTruthy();
        if (!canvas) return;

        const tools = ['pen', 'eraser-radial', 'eraser-line', 'select'] as const;
        const TOOL_CHANGES = 100;

        vi.useRealTimers();
        const startTime = performance.now();

        for (let i = 0; i < TOOL_CHANGES; i++) {
            const tool = tools[i % tools.length];
            rerender(
                <CanvasBoard
                    theme="dark"
                    activeTool={tool}
                    onStrokeEnd={onStrokeEnd}
                    refCallback={refCallback}
                    contentRefCallback={contentRefCallback}
                />
            );
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log('\n=== Tool Change Performance Results ===');
        console.log(`Tool changes: ${TOOL_CHANGES}`);
        console.log(`Total duration: ${duration.toFixed(2)}ms`);
        console.log(`Average per change: ${(duration / TOOL_CHANGES).toFixed(3)}ms`);
        console.log('=======================================\n');

        // Tool changes should be very fast (< 5ms each on average)
        expect(duration / TOOL_CHANGES).toBeLessThan(5);
    });
});
