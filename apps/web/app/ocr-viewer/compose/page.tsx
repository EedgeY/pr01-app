'use client';

import { useState, useCallback, useMemo } from 'react';
import type { NormalizedOcr } from '@workspace/ai/src/ocr/types';
import {
  availableModels,
  defaultModel,
} from '@workspace/ai/src/clients/models';
import { usePdfPreview } from '../_hooks/usePdfPreview';
import { useSegments, type Segment } from '../_hooks/useSegments';
import { SegmentRunPanel } from '../_components/SegmentRunPanel';
import { UploadSection } from './_components/UploadSection';
import { PageSelector } from './_components/PageSelector';
import { PreviewPanel } from './_components/PreviewPanel';
import { LayoutElementsPanel } from './_components/LayoutElementsPanel';

type ElementType = 'block' | 'table' | 'figure';

type Bbox = { x: number; y: number; w: number; h: number };

type SelectedElement = {
  id: string;
  type: ElementType;
  index: number;
  bbox: Bbox;
  label: string;
};

const createElementId = (type: ElementType, index: number) =>
  `${type}-${index}`;

/**
 * レイアウト支援セグメント化ルート
 * フロー: レイアウトOCR → ユーザーが bbox を選択/グルーピング（Union）してセグメント生成 → 既存セグメント処理（OCR-only→LLM） → 結果統合/提示
 */
export default function ComposeOcrPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [layoutOcr, setLayoutOcr] = useState<NormalizedOcr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState(0);
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel);

  // オーバーレイ表示トグル
  const [showBlocks, setShowBlocks] = useState(true);
  const [showTables, setShowTables] = useState(true);
  const [showFigures, setShowFigures] = useState(true);

  // 選択状態（チェックボックス）
  const [selectedBlocks, setSelectedBlocks] = useState<Set<number>>(new Set());
  const [selectedTables, setSelectedTables] = useState<Set<number>>(new Set());
  const [selectedFigures, setSelectedFigures] = useState<Set<number>>(
    new Set()
  );

  // 削除された要素（非表示にする）
  const [deletedBlocks, setDeletedBlocks] = useState<Set<number>>(new Set());
  const [deletedTables, setDeletedTables] = useState<Set<number>>(new Set());
  const [deletedFigures, setDeletedFigures] = useState<Set<number>>(new Set());

  // セグメント化済み要素（グループ化または個別セグメント化されたもの）
  const [segmentedBlocks, setSegmentedBlocks] = useState<Set<number>>(
    new Set()
  );
  const [segmentedTables, setSegmentedTables] = useState<Set<number>>(
    new Set()
  );
  const [segmentedFigures, setSegmentedFigures] = useState<Set<number>>(
    new Set()
  );

  const [selectedElementOrderIds, setSelectedElementOrderIds] = useState<
    string[]
  >([]);
  const [editableBboxes, setEditableBboxes] = useState<Map<string, Bbox>>(
    new Map()
  );

  const resetSelectionState = useCallback(() => {
    setSelectedBlocks(new Set());
    setSelectedTables(new Set());
    setSelectedFigures(new Set());
    setSelectedElementOrderIds([]);
    setEditableBboxes(new Map());
  }, []);

  const resetPageScopedState = useCallback(() => {
    resetSelectionState();
    setDeletedBlocks(new Set());
    setDeletedTables(new Set());
    setDeletedFigures(new Set());
    setSegmentedBlocks(new Set());
    setSegmentedTables(new Set());
    setSegmentedFigures(new Set());
  }, [resetSelectionState]);

  const removeFromSelectionOrder = useCallback((id: string) => {
    setSelectedElementOrderIds((prev) =>
      prev.filter((existingId) => existingId !== id)
    );
    setEditableBboxes((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // PDF preview hook
  const { imageUrls, generatePreview, clearPreview } = usePdfPreview();

  // セグメント削除時にレイアウト要素のセグメント化状態を解除する処理
  const handleSegmentDelete = useCallback((segment: Segment) => {
    if (segment.relatedElements) {
      // 関連するブロックのセグメント化状態を解除
      setSegmentedBlocks((prev) => {
        const newSet = new Set(prev);
        segment.relatedElements!.blocks.forEach((idx: number) => {
          newSet.delete(idx);
        });
        return newSet;
      });

      // 関連するテーブルのセグメント化状態を解除
      setSegmentedTables((prev) => {
        const newSet = new Set(prev);
        segment.relatedElements!.tables.forEach((idx: number) => {
          newSet.delete(idx);
        });
        return newSet;
      });

      // 関連するフィギュアのセグメント化状態を解除
      setSegmentedFigures((prev) => {
        const newSet = new Set(prev);
        segment.relatedElements!.figures.forEach((idx: number) => {
          newSet.delete(idx);
        });
        return newSet;
      });
    }
  }, []);

  // Segments hook
  const {
    segments,
    results,
    selectedSegmentId,
    addSegment,
    updateSegment,
    deleteSegment,
    selectSegment,
    updateResult,
  } = useSegments(handleSegmentDelete);

  // ファイル選択
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setLayoutOcr(null);
      setError(null);
      clearPreview();
      resetPageScopedState();
    }
  };

  // レイアウトOCR実行
  const handleRunLayout = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dpi', '300');

      const response = await fetch('/api/ocr/layout-only', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || errorData.error || 'レイアウト解析に失敗しました'
        );
      }

      const ocrData: NormalizedOcr = await response.json();

      // blocksをY座標順（上から下）にソート
      if (ocrData.pages) {
        ocrData.pages.forEach((page) => {
          if (page.blocks) {
            page.blocks.sort((a, b) => {
              // Y座標で比較（上から下）
              const aTop = a.bbox.y;
              const bTop = b.bbox.y;

              // Y座標の差が小さい場合（同じ行とみなす）はX座標で比較
              const yDiff = aTop - bTop;
              if (Math.abs(yDiff) < 0.01) {
                // 同じ行なら左から右へ
                return a.bbox.x - b.bbox.x;
              }

              return yDiff;
            });
          }

          // tablesもソート
          if (page.tables) {
            page.tables.sort((a, b) => a.bbox.y - b.bbox.y);
          }

          // figuresもソート
          if (page.figures) {
            page.figures.sort((a, b) => a.bbox.y - b.bbox.y);
          }
        });
      }

      console.log('[Compose OCR] Received layout OCR data (sorted by Y):', {
        pages: ocrData.pages?.length,
        totalBlocks: ocrData.pages?.reduce(
          (sum, p) => sum + p.blocks.length,
          0
        ),
      });
      setLayoutOcr(ocrData);

      // 画像URLを生成（プレビュー用）
      await generatePreview(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [file, generatePreview]);

  // Union bbox 計算
  const unionBboxes = useCallback(
    (bboxes: { x: number; y: number; w: number; h: number }[]) => {
      if (bboxes.length === 0) return null;
      const minX = Math.min(...bboxes.map((b) => b.x));
      const minY = Math.min(...bboxes.map((b) => b.y));
      const maxX = Math.max(...bboxes.map((b) => b.x + b.w));
      const maxY = Math.max(...bboxes.map((b) => b.y + b.h));
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    },
    []
  );

  // 選択要素をグループ化してセグメント化（Union）
  const handleCreateGroupSegment = useCallback(() => {
    if (!layoutOcr) return;

    const currentPage = layoutOcr.pages[selectedPage];
    if (!currentPage) return;

    const bboxes: { x: number; y: number; w: number; h: number }[] = [];

    // 選択されたブロックのbboxを収集
    selectedBlocks.forEach((idx) => {
      const block = currentPage.blocks[idx];
      if (block) {
        bboxes.push(block.bbox);
      }
    });

    // 選択されたテーブルのbboxを収集
    selectedTables.forEach((idx) => {
      const table = currentPage.tables?.[idx];
      if (table) {
        bboxes.push(table.bbox);
      }
    });

    // 選択されたフィギュアのbboxを収集
    selectedFigures.forEach((idx) => {
      const figure = currentPage.figures?.[idx];
      if (figure) {
        bboxes.push(figure.bbox);
      }
    });

    if (bboxes.length === 0) {
      setError('要素を選択してください');
      return;
    }

    const unionBbox = unionBboxes(bboxes);
    if (!unionBbox) return;

    // セグメントを生成（含まれる要素情報を記録）
    const newSegment = {
      id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      page: selectedPage,
      nx: unionBbox.x,
      ny: unionBbox.y,
      nw: unionBbox.w,
      nh: unionBbox.h,
      relatedElements: {
        blocks: [...selectedBlocks],
        tables: [...selectedTables],
        figures: [...selectedFigures],
      },
    };

    addSegment(newSegment);

    // セグメント化済みとしてマーク
    setSegmentedBlocks((prev) => new Set([...prev, ...selectedBlocks]));
    setSegmentedTables((prev) => new Set([...prev, ...selectedTables]));
    setSegmentedFigures((prev) => new Set([...prev, ...selectedFigures]));

    // 選択をクリア
    resetSelectionState();
  }, [
    layoutOcr,
    selectedPage,
    selectedBlocks,
    selectedTables,
    selectedFigures,
    unionBboxes,
    addSegment,
    resetSelectionState,
  ]);

  // 未セグメント化の要素を全て個別セグメント化
  const handleCreateAllIndividualSegments = useCallback(() => {
    if (!layoutOcr) return;

    const currentPage = layoutOcr.pages[selectedPage];
    if (!currentPage) return;

    let count = 0;

    // 未セグメント化・未削除のブロックを個別セグメント化
    currentPage.blocks.forEach((block, idx) => {
      if (!deletedBlocks.has(idx) && !segmentedBlocks.has(idx)) {
        const newSegment = {
          id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${count}`,
          page: selectedPage,
          nx: block.bbox.x,
          ny: block.bbox.y,
          nw: block.bbox.w,
          nh: block.bbox.h,
          relatedElements: {
            blocks: [idx],
            tables: [],
            figures: [],
          },
        };
        addSegment(newSegment);
        setSegmentedBlocks((prev) => new Set(prev).add(idx));
        count++;
      }
    });

    // 未セグメント化・未削除のテーブルを個別セグメント化
    currentPage.tables?.forEach((table, idx) => {
      if (!deletedTables.has(idx) && !segmentedTables.has(idx)) {
        const newSegment = {
          id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${count}`,
          page: selectedPage,
          nx: table.bbox.x,
          ny: table.bbox.y,
          nw: table.bbox.w,
          nh: table.bbox.h,
          relatedElements: {
            blocks: [],
            tables: [idx],
            figures: [],
          },
        };
        addSegment(newSegment);
        setSegmentedTables((prev) => new Set(prev).add(idx));
        count++;
      }
    });

    // 未セグメント化・未削除のフィギュアを個別セグメント化
    currentPage.figures?.forEach((figure, idx) => {
      if (!deletedFigures.has(idx) && !segmentedFigures.has(idx)) {
        const newSegment = {
          id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${count}`,
          page: selectedPage,
          nx: figure.bbox.x,
          ny: figure.bbox.y,
          nw: figure.bbox.w,
          nh: figure.bbox.h,
          relatedElements: {
            blocks: [],
            tables: [],
            figures: [idx],
          },
        };
        addSegment(newSegment);
        setSegmentedFigures((prev) => new Set(prev).add(idx));
        count++;
      }
    });

    console.log(`[Compose] Created ${count} individual segments`);
  }, [
    layoutOcr,
    selectedPage,
    deletedBlocks,
    deletedTables,
    deletedFigures,
    segmentedBlocks,
    segmentedTables,
    segmentedFigures,
    addSegment,
  ]);

  // チェックボックストグル
  const toggleBlockSelection = useCallback(
    (idx: number) => {
      const id = createElementId('block', idx);
      setSelectedBlocks((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) {
          next.delete(idx);
          removeFromSelectionOrder(id);
        } else {
          next.add(idx);
          setSelectedElementOrderIds((order) =>
            order.includes(id) ? order : [...order, id]
          );
        }
        return next;
      });
    },
    [removeFromSelectionOrder]
  );

  const toggleTableSelection = useCallback(
    (idx: number) => {
      const id = createElementId('table', idx);
      setSelectedTables((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) {
          next.delete(idx);
          removeFromSelectionOrder(id);
        } else {
          next.add(idx);
          setSelectedElementOrderIds((order) =>
            order.includes(id) ? order : [...order, id]
          );
        }
        return next;
      });
    },
    [removeFromSelectionOrder]
  );

  const toggleFigureSelection = useCallback(
    (idx: number) => {
      const id = createElementId('figure', idx);
      setSelectedFigures((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) {
          next.delete(idx);
          removeFromSelectionOrder(id);
        } else {
          next.add(idx);
          setSelectedElementOrderIds((order) =>
            order.includes(id) ? order : [...order, id]
          );
        }
        return next;
      });
    },
    [removeFromSelectionOrder]
  );

  // 削除/復元ハンドラー（トグル動作）
  const handleDeleteBlock = useCallback(
    (idx: number) => {
      removeFromSelectionOrder(createElementId('block', idx));
      setDeletedBlocks((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(idx)) {
          newSet.delete(idx); // 復元
        } else {
          newSet.add(idx); // 削除
        }
        return newSet;
      });
      setSelectedBlocks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(idx);
        return newSet;
      });
      setSegmentedBlocks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(idx);
        return newSet;
      });
    },
    [removeFromSelectionOrder]
  );

  const handleDeleteTable = useCallback(
    (idx: number) => {
      removeFromSelectionOrder(createElementId('table', idx));
      setDeletedTables((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(idx)) {
          newSet.delete(idx); // 復元
        } else {
          newSet.add(idx); // 削除
        }
        return newSet;
      });
      setSelectedTables((prev) => {
        const newSet = new Set(prev);
        newSet.delete(idx);
        return newSet;
      });
      setSegmentedTables((prev) => {
        const newSet = new Set(prev);
        newSet.delete(idx);
        return newSet;
      });
    },
    [removeFromSelectionOrder]
  );

  const handleDeleteFigure = useCallback(
    (idx: number) => {
      removeFromSelectionOrder(createElementId('figure', idx));
      setDeletedFigures((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(idx)) {
          newSet.delete(idx); // 復元
        } else {
          newSet.add(idx); // 削除
        }
        return newSet;
      });
      setSelectedFigures((prev) => {
        const newSet = new Set(prev);
        newSet.delete(idx);
        return newSet;
      });
      setSegmentedFigures((prev) => {
        const newSet = new Set(prev);
        newSet.delete(idx);
        return newSet;
      });
    },
    [removeFromSelectionOrder]
  );

  // 全選択/全解除
  const handleSelectAll = useCallback(() => {
    if (!layoutOcr) return;
    const currentPage = layoutOcr.pages[selectedPage];
    if (!currentPage) return;

    // 削除されていない要素のみを対象
    const availableBlocks = currentPage.blocks
      .map((_, idx) => idx)
      .filter((idx) => !deletedBlocks.has(idx));
    const availableTables = (currentPage.tables || [])
      .map((_, idx) => idx)
      .filter((idx) => !deletedTables.has(idx));
    const availableFigures = (currentPage.figures || [])
      .map((_, idx) => idx)
      .filter((idx) => !deletedFigures.has(idx));

    const allSelected =
      selectedBlocks.size === availableBlocks.length &&
      selectedTables.size === availableTables.length &&
      selectedFigures.size === availableFigures.length &&
      availableBlocks.length +
        availableTables.length +
        availableFigures.length >
        0;

    if (allSelected) {
      resetSelectionState();
    } else {
      setSelectedBlocks(new Set(availableBlocks));
      setSelectedTables(new Set(availableTables));
      setSelectedFigures(new Set(availableFigures));
      setEditableBboxes(new Map());
      setSelectedElementOrderIds([
        ...availableBlocks.map((idx) => createElementId('block', idx)),
        ...availableTables.map((idx) => createElementId('table', idx)),
        ...availableFigures.map((idx) => createElementId('figure', idx)),
      ]);
    }
  }, [
    layoutOcr,
    selectedPage,
    selectedBlocks,
    selectedTables,
    selectedFigures,
    deletedBlocks,
    deletedTables,
    deletedFigures,
    resetSelectionState,
  ]);

  const currentPage = layoutOcr?.pages[selectedPage];
  const hasSelection =
    selectedBlocks.size > 0 ||
    selectedTables.size > 0 ||
    selectedFigures.size > 0;

  const selectedElementsMap = useMemo(() => {
    if (!currentPage) return new Map<string, SelectedElement>();

    const map = new Map<string, SelectedElement>();

    selectedBlocks.forEach((idx) => {
      const block = currentPage.blocks[idx];
      if (!block) return;
      map.set(createElementId('block', idx), {
        id: createElementId('block', idx),
        type: 'block',
        index: idx,
        bbox: block.bbox,
        label: `Block ${idx + 1}: ${block.text?.slice(0, 30) || ''}...`,
      });
    });

    selectedTables.forEach((idx) => {
      const table = currentPage.tables?.[idx];
      if (!table) return;
      map.set(createElementId('table', idx), {
        id: createElementId('table', idx),
        type: 'table',
        index: idx,
        bbox: table.bbox,
        label: `Table ${idx + 1}: ${table.rows}×${table.cols}`,
      });
    });

    selectedFigures.forEach((idx) => {
      const figure = currentPage.figures?.[idx];
      if (!figure) return;
      map.set(createElementId('figure', idx), {
        id: createElementId('figure', idx),
        type: 'figure',
        index: idx,
        bbox: figure.bbox,
        label: `Figure ${idx + 1}: ${figure.figureType}`,
      });
    });

    return map;
  }, [currentPage, selectedBlocks, selectedTables, selectedFigures]);

  const selectedElements = useMemo(() => {
    const ordered: SelectedElement[] = [];
    const seen = new Set<string>();

    selectedElementOrderIds.forEach((id) => {
      const element = selectedElementsMap.get(id);
      if (!element) return;
      ordered.push(element);
      seen.add(id);
    });

    selectedElementsMap.forEach((element, id) => {
      if (!seen.has(id)) {
        ordered.push(element);
      }
    });

    return ordered;
  }, [selectedElementOrderIds, selectedElementsMap]);

  const handleSelectedOrderChange = useCallback((nextIds: string[]) => {
    setSelectedElementOrderIds(nextIds);
  }, []);

  const handlePageChange = useCallback(
    (pageIndex: number) => {
      setSelectedPage(pageIndex);
      resetPageScopedState();
    },
    [resetPageScopedState]
  );

  // bboxを更新
  const updateBbox = useCallback((id: string, bbox: Bbox) => {
    setEditableBboxes((prev) => {
      const newMap = new Map(prev);
      newMap.set(id, bbox);
      return newMap;
    });
  }, []);

  // 編集可能なbboxを取得（編集されていれば編集後、そうでなければ元のbbox）
  const getEditableBbox = useCallback(
    (type: ElementType, index: number, originalBbox: Bbox) => {
      const id = createElementId(type, index);
      return editableBboxes.get(id) || originalBbox;
    },
    [editableBboxes]
  );

  // 選択中の要素のbboxを計算（プレビュー用）- 並び替え順序と編集を反映
  const selectedBboxes = useMemo(() => {
    return selectedElements.map((el) => ({
      bbox: getEditableBbox(el.type, el.index, el.bbox),
      type: el.type,
      id: el.id,
    }));
  }, [selectedElements, getEditableBbox]);

  // グループ化範囲のUnion bbox（プレビュー用）
  const unionPreviewBbox = useMemo(() => {
    if (selectedBboxes.length === 0) return null;
    return unionBboxes(selectedBboxes.map((item) => item.bbox));
  }, [selectedBboxes, unionBboxes]);

  // 削除された要素のbboxを計算（プレビュー用）
  const deletedBboxes = useMemo(() => {
    if (!currentPage) return [];
    const bboxes: Array<{ bbox: Bbox; type: ElementType }> = [];

    deletedBlocks.forEach((idx) => {
      const block = currentPage.blocks[idx];
      if (block) {
        bboxes.push({ bbox: block.bbox, type: 'block' });
      }
    });

    deletedTables.forEach((idx) => {
      const table = currentPage.tables?.[idx];
      if (table) {
        bboxes.push({ bbox: table.bbox, type: 'table' });
      }
    });

    deletedFigures.forEach((idx) => {
      const figure = currentPage.figures?.[idx];
      if (figure) {
        bboxes.push({ bbox: figure.bbox, type: 'figure' });
      }
    });

    return bboxes;
  }, [currentPage, deletedBlocks, deletedTables, deletedFigures]);

  return (
    <div className='min-h-screen bg-background text-foreground'>
      <div className=' mx-auto p-6'>
        {/* ヘッダー */}

        {/* アップロードセクション */}
        <UploadSection
          file={file}
          loading={loading}
          onFileChange={handleFileChange}
          onRunLayout={handleRunLayout}
        />

        {/* エラー表示 */}
        {error && (
          <div className='mb-6 p-4 bg-destructive/10 border-l-4 border-destructive rounded-lg'>
            <div className='flex items-start'>
              <svg
                className='w-5 h-5 text-destructive mt-0.5 mr-3'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                  clipRule='evenodd'
                />
              </svg>
              <div>
                <h3 className='text-sm font-medium text-destructive'>Error</h3>
                <p className='text-sm text-destructive/90 mt-1'>{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* メインコンテンツ */}
        {layoutOcr && imageUrls.length > 0 && (
          <>
            {/* ページセレクター & モデル選択 */}
            <div className='mb-2 flex items-center gap-4 flex-wrap'>
              <PageSelector
                imageUrls={imageUrls}
                selectedPage={selectedPage}
                onChange={handlePageChange}
              />

              {/* モデル選択 */}
              <div className='flex items-center gap-2'>
                <label className='text-sm font-medium text-muted-foreground'>
                  LLMモデル:
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className='border border-input rounded-md px-3 py-1.5 text-sm bg-background'
                  title={
                    availableModels.find((m) => m.id === selectedModel)
                      ?.description
                  }
                >
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className='grid grid-cols-4  gap-6 mb-6'>
              {/* 左: プレビュー */}
              <div className='lg:col-span-2'>
                <PreviewPanel
                  currentPage={currentPage}
                  imageUrl={imageUrls[selectedPage]}
                  showBlocks={showBlocks}
                  showTables={showTables}
                  showFigures={showFigures}
                  onToggleBlocks={(checked) => setShowBlocks(checked)}
                  onToggleTables={(checked) => setShowTables(checked)}
                  onToggleFigures={(checked) => setShowFigures(checked)}
                  selectedBboxes={selectedBboxes}
                  unionPreviewBbox={unionPreviewBbox}
                  deletedBboxes={deletedBboxes}
                  onBboxUpdate={updateBbox}
                />
              </div>

              {/* 右: レイアウト要素一覧 */}
              <div className='lg:col-span-1'>
                <LayoutElementsPanel
                  currentPage={currentPage}
                  selectedBlocks={selectedBlocks}
                  selectedTables={selectedTables}
                  selectedFigures={selectedFigures}
                  segmentedBlocks={segmentedBlocks}
                  segmentedTables={segmentedTables}
                  segmentedFigures={segmentedFigures}
                  deletedBlocks={deletedBlocks}
                  deletedTables={deletedTables}
                  deletedFigures={deletedFigures}
                  onToggleBlock={toggleBlockSelection}
                  onToggleTable={toggleTableSelection}
                  onToggleFigure={toggleFigureSelection}
                  onToggleDeleteBlock={handleDeleteBlock}
                  onToggleDeleteTable={handleDeleteTable}
                  onToggleDeleteFigure={handleDeleteFigure}
                  onSelectAll={handleSelectAll}
                  onCreateAllIndividualSegments={
                    handleCreateAllIndividualSegments
                  }
                  onCreateGroupSegment={handleCreateGroupSegment}
                  hasSelection={hasSelection}
                  selectedElements={selectedElements}
                  onOrderChange={handleSelectedOrderChange}
                />
              </div>
              <div className='lg:col-span-1'>
                <SegmentRunPanel
                  file={file}
                  segments={segments}
                  results={results}
                  onResultUpdate={updateResult}
                  onSegmentSelect={selectSegment}
                  selectedId={selectedSegmentId}
                  onSegmentDelete={deleteSegment}
                  model={selectedModel}
                />
              </div>
            </div>
          </>
        )}

        {/* 空状態 */}
        {!layoutOcr && !loading && (
          <div className='text-center py-12 text-muted-foreground'>
            <p className='text-lg'>
              ファイルを選択して「レイアウト解析を実行」してください
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
