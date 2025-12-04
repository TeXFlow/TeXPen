import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ToolType, Point, Stroke } from '../types/canvas';

interface CanvasBoardProps {
    onStrokeEnd: () => void;
    refCallback: (ref: HTMLCanvasElement | null) => void;
    theme: 'dark' | 'light';
    activeTool: ToolType;
}

const ERASER_SIZE = 20;

const CanvasBoard: React.FC<CanvasBoardProps> = ({ onStrokeEnd, refCallback, theme, activeTool }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
    const lastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track strokes for line eraser
    const strokesRef = useRef<Stroke[]>([]);
    const currentStrokeRef = useRef<Point[]>([]);

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

    // Redraw all strokes
    const redrawStrokes = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = theme === 'dark' ? '#ffffff' : '#000000';

        strokesRef.current.forEach(stroke => {
            if (stroke.points.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
        });
    }, [theme]);

    // Handle Theme Changes: Recolors existing strokes
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // We use composition to replace the color of existing non-transparent pixels
        ctx.save();
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#000000';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

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

    // Check if a point is near a stroke segment
    const isPointNearStroke = (point: Point, stroke: Stroke, threshold: number): boolean => {
        for (let i = 0; i < stroke.points.length - 1; i++) {
            const a = stroke.points[i];
            const b = stroke.points[i + 1];

            const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
            if (l2 === 0) {
                if (Math.sqrt(Math.pow(point.x - a.x, 2) + Math.pow(point.y - a.y, 2)) < threshold) {
                    return true;
                }
                continue;
            }

            let t = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / l2;
            t = Math.max(0, Math.min(1, t));

            const proj = {
                x: a.x + t * (b.x - a.x),
                y: a.y + t * (b.y - a.y)
            };

            const dist = Math.sqrt(Math.pow(point.x - proj.x, 2) + Math.pow(point.y - proj.y, 2));
            if (dist < threshold) {
                return true;
            }
        }
        return false;
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        const pos = getPos(e);
        lastPos.current = pos;

        if (activeTool === 'pen') {
            currentStrokeRef.current = [pos];
        }

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        const currentPos = getPos(e);
        setCursorPos(currentPos);

        if (!isDrawing) return;
        if ('touches' in e) e.preventDefault();

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        if (activeTool === 'pen') {
            // Draw stroke
            ctx.beginPath();
            ctx.moveTo(lastPos.current.x, lastPos.current.y);
            ctx.lineTo(currentPos.x, currentPos.y);
            ctx.globalCompositeOperation = 'source-over';
            ctx.lineWidth = 3;
            ctx.strokeStyle = theme === 'dark' ? '#ffffff' : '#000000';
            ctx.stroke();

            currentStrokeRef.current.push(currentPos);

        } else if (activeTool === 'eraser-radial') {
            // Radial erase
            ctx.beginPath();
            ctx.moveTo(lastPos.current.x, lastPos.current.y);
            ctx.lineTo(currentPos.x, currentPos.y);
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = ERASER_SIZE;
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';

            // Also remove from strokes data for consistency
            strokesRef.current = strokesRef.current.filter(stroke =>
                !isPointNearStroke(currentPos, stroke, ERASER_SIZE / 2)
            );

        } else if (activeTool === 'eraser-line') {
            // Line erase - remove entire strokes
            const beforeCount = strokesRef.current.length;
            strokesRef.current = strokesRef.current.filter(stroke =>
                !isPointNearStroke(currentPos, stroke, 10)
            );

            if (strokesRef.current.length !== beforeCount) {
                redrawStrokes();
            }
        }

        lastPos.current = currentPos;
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);

            // Save stroke for line eraser
            if (activeTool === 'pen' && currentStrokeRef.current.length > 1) {
                strokesRef.current.push({
                    points: [...currentStrokeRef.current],
                    tool: 'pen',
                    color: theme === 'dark' ? '#ffffff' : '#000000',
                    width: 3
                });
            }
            currentStrokeRef.current = [];

            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                onStrokeEnd();
            }, 600);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        setCursorPos(getPos(e));
        draw(e);
    };

    const handleMouseLeave = () => {
        setCursorPos(null);
        stopDrawing();
    };

    const showEraserCursor = (activeTool === 'eraser-radial' || activeTool === 'eraser-line') && cursorPos;

    return (
        <div
            ref={containerRef}
            className="w-full h-full touch-none overflow-hidden transition-all duration-500 relative"
            style={{
                cursor: 'none',
                backgroundImage: `radial-gradient(${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)'} 1px, transparent 1px)`,
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0'
            }}
        >
            <canvas
                ref={canvasRef}
                className="block touch-none"
                onMouseDown={startDrawing}
                onMouseMove={handleMouseMove}
                onMouseUp={stopDrawing}
                onMouseLeave={handleMouseLeave}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />

            {/* Custom cursor */}
            {cursorPos && (
                <div
                    className="pointer-events-none fixed z-50"
                    style={{
                        left: cursorPos.x + (containerRef.current?.getBoundingClientRect().left ?? 0),
                        top: cursorPos.y + (containerRef.current?.getBoundingClientRect().top ?? 0),
                        transform: 'translate(-50%, -50%)'
                    }}
                >
                    {showEraserCursor ? (
                        <div
                            className="rounded-full border-2"
                            style={{
                                width: activeTool === 'eraser-radial' ? ERASER_SIZE : 20,
                                height: activeTool === 'eraser-radial' ? ERASER_SIZE : 20,
                                borderColor: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                                borderStyle: activeTool === 'eraser-line' ? 'dashed' : 'solid'
                            }}
                        />
                    ) : (
                        <div
                            className="rounded-full"
                            style={{
                                width: 6,
                                height: 6,
                                backgroundColor: theme === 'dark' ? '#fff' : '#000'
                            }}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default CanvasBoard;