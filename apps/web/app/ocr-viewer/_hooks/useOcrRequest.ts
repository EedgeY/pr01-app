import { useState, useCallback } from 'react';
import type { NormalizedOcr } from '@workspace/ai/src/ocr/types';
import { usePdfPreview } from './usePdfPreview';
import { sortByPosition } from '../_utils/geometry';

type OcrMode = 'ocr' | 'layout' | 'segment';

interface UseOcrRequestOptions {
  mode?: OcrMode;
  onFileChange?: (file: File | null) => void;
}

export const useOcrRequest = (options: UseOcrRequestOptions = {}) => {
  const { mode = 'ocr', onFileChange: onFileChangeCallback } = options;

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [ocr, setOcr] = useState<NormalizedOcr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState(0);

  // PDF preview hook - 外部システム（ファイル→画像変換）との同期
  const { imageUrls, generatePreview, clearPreview } = usePdfPreview();

  const handleFileChange = useCallback(
    async (selectedFile: File | null) => {
      setFile(selectedFile);
      setOcr(null);
      setError(null);
      clearPreview();

      if (selectedFile) {
        onFileChangeCallback?.(selectedFile);

        // セグメントモードの場合は即座にプレビューを生成（外部同期: ファイル→画像）
        if (mode === 'segment') {
          await generatePreview(selectedFile);
        }
      }
    },
    [mode, generatePreview, clearPreview, onFileChangeCallback]
  );

  // OCR実行（外部同期: API呼び出し）
  const runOcr = useCallback(
    async (endpoint: 'ocr-only' | 'layout-only') => {
      if (!file) return;

      setLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('dpi', '300');

        const response = await fetch(`/api/ocr/${endpoint}`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.details || errorData.error || 'OCR処理に失敗しました'
          );
        }

        const ocrData: NormalizedOcr = await response.json();

        // レイアウトモードの場合、blocksをY座標順（上から下）にソート
        if (endpoint === 'layout-only' && ocrData.pages) {
          ocrData.pages.forEach((page) => {
            if (page.blocks) {
              page.blocks = sortByPosition(page.blocks);
            }
            if (page.tables) {
              page.tables = sortByPosition(page.tables);
            }
            if (page.figures) {
              page.figures = sortByPosition(page.figures);
            }
          });
        }

        console.log(`[OCR Request] Received ${endpoint} data:`, {
          pages: ocrData.pages?.length,
          totalBlocks: ocrData.pages?.reduce(
            (sum, p) => sum + p.blocks.length,
            0
          ),
        });
        setOcr(ocrData);

        // 画像URLを生成（外部同期: ファイル→画像）
        await generatePreview(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [file, generatePreview]
  );

  const runOcrOnly = useCallback(() => runOcr('ocr-only'), [runOcr]);
  const runLayoutOnly = useCallback(() => runOcr('layout-only'), [runOcr]);

  return {
    file,
    setFile: handleFileChange,
    loading,
    ocr,
    error,
    setError,
    selectedPage,
    setSelectedPage,
    imageUrls,
    runOcrOnly,
    runLayoutOnly,
    generatePreview,
    clearPreview,
  };
};

