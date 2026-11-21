export interface Point {
  x: number;
  y: number;
}

export interface SelectionRegion {
  type: 'rect' | 'path';
  data: any;
}

export interface RectDragPoints {
  current: Point;
  opposite: Point;
}
