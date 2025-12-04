export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export type ToolType = 'pen' | 'eraser-radial' | 'eraser-line';

export interface Stroke {
  points: Point[];
  tool: ToolType;
  color: string;
  width: number;
}
