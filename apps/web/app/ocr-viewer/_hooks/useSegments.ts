/**
 * セグメント管理用カスタムフック
 */

import { useState, useCallback } from 'react';
import type { NormalizedOcr } from '@workspace/ai/src/ocr/types';
import type { PdfmeTextSchema } from '@workspace/ai/src/ocr';

export interface Segment {
  id: string;
  page: number;
  nx: number; // normalized x [0..1]
  ny: number; // normalized y [0..1]
  nw: number; // normalized width [0..1]
  nh: number; // normalized height [0..1]
}

export interface SegmentResult {
  status: 'pending' | 'processing' | 'success' | 'error';
  pdfBlob?: Blob;
  ocrResult?: NormalizedOcr;
  error?: string;
  // セグメント単位のLLM出力（スキーマ）
  llmSchemas?: PdfmeTextSchema[];
  llmError?: string;
}

export function useSegments() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [results, setResults] = useState<Map<string, SegmentResult>>(new Map());
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  const addSegment = useCallback((segment: Segment) => {
    setSegments((prev) => [...prev, segment]);
    setResults((prev) => new Map(prev).set(segment.id, { status: 'pending' }));
  }, []);

  const updateSegment = useCallback((id: string, updates: Partial<Segment>) => {
    setSegments((prev) =>
      prev.map((seg) => (seg.id === id ? { ...seg, ...updates } : seg))
    );
  }, []);

  const deleteSegment = useCallback((id: string) => {
    setSegments((prev) => prev.filter((seg) => seg.id !== id));
    setResults((prev) => {
      const newResults = new Map(prev);
      newResults.delete(id);
      return newResults;
    });
    if (selectedSegmentId === id) {
      setSelectedSegmentId(null);
    }
  }, [selectedSegmentId]);

  const selectSegment = useCallback((id: string | null) => {
    setSelectedSegmentId(id);
  }, []);

  const updateResult = useCallback((id: string, result: Partial<SegmentResult>) => {
    setResults((prev) => {
      const newResults = new Map(prev);
      const current = newResults.get(id) || { status: 'pending' as const };
      newResults.set(id, { ...current, ...result });
      return newResults;
    });
  }, []);

  return {
    segments,
    results,
    selectedSegmentId,
    addSegment,
    updateSegment,
    deleteSegment,
    selectSegment,
    updateResult,
  };
}

