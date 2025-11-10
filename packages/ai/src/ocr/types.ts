/**
 * OCR types and schemas
 * 
 * Normalized OCR output schema that is DPI-independent.
 * All bboxes are stored in normalized coordinates [0,1] as primary representation.
 */

/**
 * Normalized bounding box (coordinates in [0,1] range)
 * Origin: top-left (0,0), bottom-right (1,1)
 */
export interface NormalizedBBox {
  x: number; // normalized x (0..1)
  y: number; // normalized y (0..1)
  w: number; // normalized width (0..1)
  h: number; // normalized height (0..1)
}

/**
 * Pixel bounding box (absolute pixel coordinates)
 * Origin: top-left (0,0)
 */
export interface PixelBBox {
  x: number; // pixel x
  y: number; // pixel y
  w: number; // pixel width
  h: number; // pixel height
}

/**
 * OCR token (character or word) with normalized bbox
 */
export interface NormalizedToken {
  text: string;
  bbox: NormalizedBBox;
  confidence?: number;
}

/**
 * Text line with normalized bbox
 */
export interface NormalizedLine {
  text: string;
  bbox: NormalizedBBox;
  tokens: NormalizedToken[];
}

/**
 * Text block (paragraph, heading, etc.) with normalized bbox
 */
export interface NormalizedBlock {
  text: string;
  bbox: NormalizedBBox;
  blockType: string; // text, title, list, caption, etc.
  lines: NormalizedLine[];
}

/**
 * Table structure with normalized bbox
 */
export interface NormalizedTable {
  bbox: NormalizedBBox;
  rows: number;
  cols: number;
  cells: Array<{
    rowIndex: number;
    colIndex: number;
    rowSpan: number;
    colSpan: number;
    text: string;
    bbox: NormalizedBBox;
  }>;
}

/**
 * Figure/image region with normalized bbox
 */
export interface NormalizedFigure {
  bbox: NormalizedBBox;
  figureType: string; // image, chart, diagram, etc.
}

/**
 * Single page with normalized coordinates
 */
export interface NormalizedPage {
  pageIndex: number;
  
  // Original dimensions (for reference and conversion)
  dpi: number;
  widthPx: number;
  heightPx: number;
  
  // Content with normalized bboxes
  blocks: NormalizedBlock[];
  tables?: NormalizedTable[];
  figures?: NormalizedFigure[];
  
  // Reading order (indices into blocks array)
  readingOrder?: number[];
}

/**
 * Complete normalized OCR result
 */
export interface NormalizedOcr {
  pages: NormalizedPage[];
  metadata: {
    processingTime: number;
    model: string;
    sourceFormat: string; // pdf, png, jpg, etc.
  };
}

/**
 * Raw OCR service response (before normalization)
 */
export interface RawOcrResponse {
  pages: Array<{
    pageIndex: number;
    dpi: number;
    widthPx: number;
    heightPx: number;
    blocks: Array<{
      text: string;
      bbox: PixelBBox;
      blockType: string;
      lines: Array<{
        text: string;
        bbox: PixelBBox;
        tokens: Array<{
          text: string;
          bbox: PixelBBox;
          confidence?: number;
        }>;
      }>;
    }>;
    tables?: Array<{
      bbox: PixelBBox;
      rows: number;
      cols: number;
      cells: any[];
    }>;
    figures?: Array<{
      bbox: PixelBBox;
      figureType: string;
    }>;
    readingOrder?: number[];
  }>;
  processingTime: number;
  model: string;
}



