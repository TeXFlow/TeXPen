import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ToolType } from '../types/canvas';

interface CanvasBoardProps {
    onStrokeEnd: () => void;
    refCallback: (ref: HTMLCanvasElement | null) => void;
    theme: 'dark' | 'light';
    activeTool: ToolType;
}

const CanvasBoard: React.FC<CanvasBoardProps> = ({ onStrokeEnd, refCallback, theme, activeTool }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const lastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Setup canvas size and style
    const setupCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const { width, height } = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const targetWidth = width * dpr;
        const targetHeight = height * dpr;

        // Check if resize is needed
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            // 1. Save existing content
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx && canvas.width > 0 && canvas.height > 0) {
                tempCtx.drawImage(canvas, 0, 0);
            }

            // 2. Resize
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            canvas.style.width = '100%';
            canvas.style.height = '100%';

            // 3. Setup Context
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.scale(dpr, dpr);
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.lineWidth = 3;

                // 4. Restore Content
                // Reset transform temporarily to draw pixel-for-pixel
                ctx.save();
                ctx.resetTransform();
                if (tempCanvas.width > 0 && tempCanvas.height > 0) {
                    ctx.drawImage(tempCanvas, 0, 0);
                }
                ctx.restore();
            }
        }

        // Always update stroke style when setup runs
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.strokeStyle = theme === 'dark' ? '#ffffff' : '#000000';
        }

        refCallback(canvas);
    }, [refCallback, theme]);

    // Handle Theme Changes: Recolors existing strokes
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // We use composition to replace the color of existing non-transparent pixels
        ctx.save();
        ctx.globalCompositeOperation = 'source-in'; // Keep alpha, replace color
        ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#000000';
        // We must use the raw width/height for fillRect because of DPI scaling logic if we were using coordinate system
        // But resetTransform is safer for full clear/fill operations on backing store
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore(); // Restores the previous context state (including dpr scale)

        // Ensure future strokes use correct color
        ctx.strokeStyle = theme === 'dark' ? '#ffffff' : '#000000';
    }, [theme]);

    useEffect(() => {
        setupCanvas();
        const handleResize = () => requestAnimationFrame(setupCanvas);
        window.addEventListener('resize', handleResize);

        const resizeObserver = new ResizeObserver(() => requestAnimationFrame(setupCanvas));
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
        };
    }, [setupCanvas]);

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        const pos = getPos(e);
        lastPos.current = pos;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        if ('touches' in e) e.preventDefault();

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const currentPos = getPos(e);

        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(currentPos.x, currentPos.y);

        // Handle different tools
        if (activeTool === 'eraser-radial') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = 20;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.lineWidth = 3;
            ctx.strokeStyle = theme === 'dark' ? '#ffffff' : '#000000';
        }

        ctx.stroke();

        // Reset for next stroke
        ctx.globalCompositeOperation = 'source-over';

        lastPos.current = currentPos;
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                onStrokeEnd();
            }, 600);
        }
    };

    // Determine cursor based on tool
    const getCursor = () => {
        if (activeTool === 'eraser-radial' || activeTool === 'eraser-line') {
            return 'cell';
        }
        return 'crosshair';
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full touch-none overflow-hidden transition-all duration-500"
            style={{
                cursor: getCursor(),
                backgroundImage: `radial-gradient(${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)'} 1px, transparent 1px)`,
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0'
            }}
        >
            <canvas
                ref={canvasRef}
                className="block touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
        </div>
    );
};

export default CanvasBoard;