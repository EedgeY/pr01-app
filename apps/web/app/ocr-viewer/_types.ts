/**
 * 共通型定義
 */

export type ElementType = 'block' | 'table' | 'figure';

export type Bbox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SelectedElement = {
  id: string;
  type: ElementType;
  index: number;
  bbox: Bbox;
  label: string;
};

