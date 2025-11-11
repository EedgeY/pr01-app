/**
 * Field Merging Utilities
 * 
 * Merges detected fields across multiple segments using IoU-based deduplication.
 */

import type { DetectedField } from '../agents/formFieldAgent';
import type { NormalizedBBox } from './types';
import { calculateIoU } from './geometry';

/**
 * Merge detected fields from multiple segments, removing duplicates
 * 
 * Algorithm:
 * 1. Collect all fields from all segments
 * 2. Group overlapping fields using IoU threshold
 * 3. For each group, select the best representative based on:
 *    - Highest confidence
 *    - Longest text (tie-breaker)
 * 4. Merge segments arrays from all fields in the group
 * 
 * @param segmentResults - Array of field arrays, one per segment
 * @param iouThreshold - IoU threshold for considering fields as duplicates (default: 0.5)
 * @returns Merged and deduplicated field array
 */
export function mergeDetectedFieldsAcrossSegments(
  segmentResults: DetectedField[][],
  iouThreshold = 0.5
): DetectedField[] {
  // Flatten all fields from all segments
  const allFields: DetectedField[] = [];
  for (const fields of segmentResults) {
    allFields.push(...fields);
  }
  
  if (allFields.length === 0) {
    return [];
  }
  
  console.log('[Merge] Total fields before deduplication:', allFields.length);
  
  // Group fields by page index for efficient processing
  const fieldsByPage = new Map<number, DetectedField[]>();
  for (const field of allFields) {
    const pageFields = fieldsByPage.get(field.pageIndex) || [];
    pageFields.push(field);
    fieldsByPage.set(field.pageIndex, pageFields);
  }
  
  // Process each page separately
  const mergedFields: DetectedField[] = [];
  for (const [pageIndex, pageFields] of fieldsByPage) {
    console.log(`[Merge] Processing page ${pageIndex} with ${pageFields.length} fields`);
    const pageMerged = mergeFieldsOnSamePage(pageFields, iouThreshold);
    console.log(`[Merge] Page ${pageIndex}: ${pageFields.length} -> ${pageMerged.length} fields`);
    mergedFields.push(...pageMerged);
  }
  
  console.log('[Merge] Total fields after deduplication:', mergedFields.length);
  
  return mergedFields;
}

/**
 * Merge fields on the same page using IoU-based clustering
 * 
 * @param fields - Fields on the same page
 * @param iouThreshold - IoU threshold for grouping
 * @returns Merged fields
 */
function mergeFieldsOnSamePage(
  fields: DetectedField[],
  iouThreshold: number
): DetectedField[] {
  if (fields.length === 0) return [];
  
  // Track which fields have been merged
  const merged = new Set<number>();
  const result: DetectedField[] = [];
  
  for (let i = 0; i < fields.length; i++) {
    if (merged.has(i)) continue;
    
    const field = fields[i];
    if (!field) continue;
    
    const group: number[] = [i];
    
    // Find all fields that overlap with this field
    for (let j = i + 1; j < fields.length; j++) {
      if (merged.has(j)) continue;
      
      const other = fields[j];
      if (!other) continue;
      
      const iou = calculateIoU(field.bboxNormalized, other.bboxNormalized);
      
      if (iou >= iouThreshold) {
        group.push(j);
      }
    }
    
    // Mark all fields in group as merged
    for (const idx of group) {
      merged.add(idx);
    }
    
    // Select best representative from group
    const groupFields = group.map(idx => fields[idx]).filter((f): f is DetectedField => f !== undefined);
    const representative = selectBestField(groupFields);
    
    // If group has multiple fields, merge their segments
    if (group.length > 1) {
      console.log(`[Merge] Merging ${group.length} overlapping fields: ${groupFields.map(f => f.name).join(', ')}`);
      representative.segments = mergeSegments(groupFields);
    }
    
    result.push(representative);
  }
  
  return result;
}

/**
 * Select the best field from a group of overlapping fields
 * 
 * Selection criteria (in order):
 * 1. Highest confidence
 * 2. Has segments (prefer segmented fields)
 * 3. Longest label text
 * 
 * @param fields - Group of overlapping fields
 * @returns Best representative field
 */
function selectBestField(fields: DetectedField[]): DetectedField {
  if (fields.length === 1 && fields[0]) {
    return fields[0];
  }
  
  if (fields.length === 0) {
    throw new Error('selectBestField: empty fields array');
  }
  
  // Sort by confidence (desc), then by label length (desc)
  const sorted = [...fields].sort((a, b) => {
    // Primary: confidence
    if (Math.abs(a.confidence - b.confidence) > 0.01) {
      return b.confidence - a.confidence;
    }
    
    // Secondary: has segments (prefer segmented)
    const aHasSegments = (a.segments?.length || 0) > 0;
    const bHasSegments = (b.segments?.length || 0) > 0;
    if (aHasSegments !== bHasSegments) {
      return aHasSegments ? -1 : 1;
    }
    
    // Tertiary: label length
    return b.label.length - a.label.length;
  });
  
  const best = sorted[0];
  if (!best) {
    throw new Error('selectBestField: no valid field found');
  }
  
  return best;
}

/**
 * Merge segments from multiple fields
 * 
 * Deduplicates segments by name, preferring segments with higher confidence bboxes.
 * 
 * @param fields - Fields to merge segments from
 * @returns Merged segments array
 */
function mergeSegments(
  fields: DetectedField[]
): DetectedField['segments'] | undefined {
  const allSegments: NonNullable<DetectedField['segments']> = [];
  
  for (const field of fields) {
    if (field.segments && field.segments.length > 0) {
      allSegments.push(...field.segments);
    }
  }
  
  if (allSegments.length === 0) {
    return undefined;
  }
  
  // Deduplicate segments by name
  const segmentsByName = new Map<string, typeof allSegments[0][]>();
  for (const seg of allSegments) {
    const existing = segmentsByName.get(seg.name) || [];
    existing.push(seg);
    segmentsByName.set(seg.name, existing);
  }
  
  // For each name, select the segment with the largest bbox (most specific)
  const result: NonNullable<DetectedField['segments']> = [];
  for (const [name, segs] of segmentsByName) {
    if (segs.length === 1 && segs[0]) {
      result.push(segs[0]);
    } else if (segs.length > 1) {
      // Select segment with largest area
      const best = segs.reduce((prev, curr) => {
        if (!prev) return curr;
        if (!curr) return prev;
        const prevArea = prev.bboxNormalized.w * prev.bboxNormalized.h;
        const currArea = curr.bboxNormalized.w * curr.bboxNormalized.h;
        return currArea > prevArea ? curr : prev;
      });
      if (best) {
        result.push(best);
      }
    }
  }
  
  return result;
}

/**
 * Calculate overlapping area between two normalized bboxes
 * 
 * @param a - First bbox
 * @param b - Second bbox
 * @returns Overlapping area (0 to 1)
 */
function calculateOverlapArea(a: NormalizedBBox, b: NormalizedBBox): number {
  const xOverlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return xOverlap * yOverlap;
}

/**
 * Group fields by proximity (used for spatial relationship analysis)
 * 
 * @param fields - Fields to group
 * @param maxDistance - Maximum distance threshold (normalized)
 * @returns Groups of nearby fields
 */
export function groupFieldsByProximity(
  fields: DetectedField[],
  maxDistance = 0.05
): DetectedField[][] {
  if (fields.length === 0) return [];
  
  const groups: DetectedField[][] = [];
  const assigned = new Set<number>();
  
  for (let i = 0; i < fields.length; i++) {
    if (assigned.has(i)) continue;
    
    const field = fields[i];
    if (!field) continue;
    
    const group: DetectedField[] = [field];
    assigned.add(i);
    
    // Find all fields within maxDistance
    for (let j = i + 1; j < fields.length; j++) {
      if (assigned.has(j)) continue;
      
      const otherField = fields[j];
      if (!otherField) continue;
      
      const distance = bboxDistance(
        field.bboxNormalized,
        otherField.bboxNormalized
      );
      
      if (distance <= maxDistance) {
        group.push(otherField);
        assigned.add(j);
      }
    }
    
    groups.push(group);
  }
  
  return groups;
}

/**
 * Calculate center-to-center distance between two bboxes
 * 
 * @param a - First bbox
 * @param b - Second bbox
 * @returns Euclidean distance
 */
function bboxDistance(a: NormalizedBBox, b: NormalizedBBox): number {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}
