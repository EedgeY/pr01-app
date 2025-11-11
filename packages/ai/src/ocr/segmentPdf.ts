/**
 * PDF Segmentation Utilities
 * 
 * Creates segment PDFs where specified regions are preserved and other areas are masked with white rectangles.
 * Maintains original page dimensions and coordinate system.
 */

import { PDFDocument, rgb, PDFPage } from 'pdf-lib';

/**
 * Segment specification with normalized coordinates [0..1]
 */
export interface SegmentSpec {
  pageIndex: number;
  x: number; // normalized x (0..1)
  y: number; // normalized y (0..1)
  w: number; // normalized width (0..1)
  h: number; // normalized height (0..1)
}

/**
 * Build masked PDF segments where only specified regions are visible
 * 
 * @param inputPdfOrImage - Input PDF or image as Uint8Array
 * @param segments - Array of segment specifications
 * @param isPdf - Whether input is PDF (true) or image (false)
 * @returns Array of PDF bytes, one per segment
 */
export async function buildMaskedPdfSegments(
  inputPdfOrImage: Uint8Array,
  segments: SegmentSpec[],
  isPdf = true
): Promise<Uint8Array[]> {
  const results: Uint8Array[] = [];

  if (isPdf) {
    // Load source PDF
    const sourcePdf = await PDFDocument.load(inputPdfOrImage);
    
    for (const seg of segments) {
      // Create new document for this segment
      const newPdf = await PDFDocument.create();
      
      // Copy the target page
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [seg.pageIndex]);
      const addedPage = newPdf.addPage(copiedPage);
      
      // Apply white mask to hide everything except the segment
      await applyWhiteMask(addedPage, seg);
      
      // Save segment PDF
      const pdfBytes = await newPdf.save();
      results.push(pdfBytes);
    }
  } else {
    // Image input: create PDF with image on full page, then mask
    // Note: This requires embedding the image which is more complex
    // For MVP, we'll throw an error and handle it later if needed
    throw new Error('Image input not yet supported - please convert to PDF first');
  }

  return results;
}

/**
 * Apply white rectangles to mask everything except the specified segment
 * 
 * Draws 4 white rectangles to cover:
 * - Top area (above segment)
 * - Bottom area (below segment)
 * - Left area (left of segment)
 * - Right area (right of segment)
 * 
 * @param page - PDF page to mask
 * @param seg - Segment specification (normalized coordinates)
 */
async function applyWhiteMask(page: PDFPage, seg: SegmentSpec): Promise<void> {
  const { width, height } = page.getSize();
  
  // Convert normalized coordinates to absolute
  const segX = seg.x * width;
  const segY = seg.y * height;
  const segW = seg.w * width;
  const segH = seg.h * height;
  
  // PDF coordinate system: origin at bottom-left
  // Our normalized coords: origin at top-left
  // Need to flip Y axis
  const segYFlipped = height - segY - segH;
  
  // Draw white rectangles to mask non-segment areas
  const white = rgb(1, 1, 1);
  
  // Top area (from top of page to top of segment)
  // In PDF coords: from segment top to page top
  const topY = segYFlipped + segH;
  const topH = height - topY;
  if (topH > 0) {
    page.drawRectangle({
      x: 0,
      y: topY,
      width,
      height: topH,
      color: white,
    });
  }
  
  // Bottom area (from bottom of page to bottom of segment)
  // In PDF coords: from 0 to segment bottom
  if (segYFlipped > 0) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: segYFlipped,
      color: white,
    });
  }
  
  // Left area (left of segment, only within segment Y range)
  if (segX > 0) {
    page.drawRectangle({
      x: 0,
      y: segYFlipped,
      width: segX,
      height: segH,
      color: white,
    });
  }
  
  // Right area (right of segment, only within segment Y range)
  const rightX = segX + segW;
  const rightW = width - rightX;
  if (rightW > 0) {
    page.drawRectangle({
      x: rightX,
      y: segYFlipped,
      width: rightW,
      height: segH,
      color: white,
    });
  }
}

/**
 * Validate segment specifications
 * 
 * @param segments - Array of segment specifications
 * @throws Error if validation fails
 */
export function validateSegments(segments: SegmentSpec[]): void {
  if (!segments || segments.length === 0) {
    throw new Error('At least one segment is required');
  }
  
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) {
      throw new Error(`Segment ${i} is undefined`);
    }
    
    if (seg.pageIndex < 0) {
      throw new Error(`Segment ${i}: pageIndex must be non-negative (got ${seg.pageIndex})`);
    }
    
    if (seg.x < 0 || seg.x > 1 || seg.y < 0 || seg.y > 1) {
      throw new Error(`Segment ${i}: x,y must be in [0,1] range (got x=${seg.x}, y=${seg.y})`);
    }
    
    if (seg.w <= 0 || seg.w > 1 || seg.h <= 0 || seg.h > 1) {
      throw new Error(`Segment ${i}: w,h must be in (0,1] range (got w=${seg.w}, h=${seg.h})`);
    }
    
    if (seg.x + seg.w > 1.001) { // Allow small floating point error
      throw new Error(`Segment ${i}: x+w exceeds page boundary (${seg.x}+${seg.w}=${seg.x + seg.w})`);
    }
    
    if (seg.y + seg.h > 1.001) { // Allow small floating point error
      throw new Error(`Segment ${i}: y+h exceeds page boundary (${seg.y}+${seg.h}=${seg.y + seg.h})`);
    }
  }
}
