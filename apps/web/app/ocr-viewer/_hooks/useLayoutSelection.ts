import { useState, useCallback, useMemo } from 'react';
import type { NormalizedOcr } from '@workspace/ai/src/ocr/types';
import type { Bbox, ElementType, SelectedElement } from '../_types';
import { createElementId, bboxUnion } from '../_utils/geometry';

export type { Segment } from './useSegments';

interface UseLayoutSelectionOptions {
  currentPage: NormalizedOcr['pages'][number] | undefined;
  onSegmentCreate?: (segment: {
    id: string;
    page: number;
    nx: number;
    ny: number;
    nw: number;
    nh: number;
    relatedElements?: {
      blocks: number[];
      tables: number[];
      figures: number[];
    };
  }) => void;
  selectedPage: number;
}

export const useLayoutSelection = ({
  currentPage,
  onSegmentCreate,
  selectedPage,
}: UseLayoutSelectionOptions) => {
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
    currentPage,
    selectedBlocks,
    selectedTables,
    selectedFigures,
    deletedBlocks,
    deletedTables,
    deletedFigures,
    resetSelectionState,
  ]);

  // 選択要素をグループ化してセグメント化（Union）
  const handleCreateGroupSegment = useCallback(() => {
    if (!currentPage) return;

    const bboxes: Bbox[] = [];

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
      throw new Error('要素を選択してください');
    }

    const unionBbox = bboxUnion(bboxes);
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

    onSegmentCreate?.(newSegment);

    // セグメント化済みとしてマーク
    setSegmentedBlocks((prev) => new Set([...prev, ...selectedBlocks]));
    setSegmentedTables((prev) => new Set([...prev, ...selectedTables]));
    setSegmentedFigures((prev) => new Set([...prev, ...selectedFigures]));

    // 選択をクリア
    resetSelectionState();
  }, [
    currentPage,
    selectedPage,
    selectedBlocks,
    selectedTables,
    selectedFigures,
    onSegmentCreate,
    resetSelectionState,
  ]);

  // 未セグメント化の要素を全て個別セグメント化
  const handleCreateAllIndividualSegments = useCallback(() => {
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
        onSegmentCreate?.(newSegment);
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
        onSegmentCreate?.(newSegment);
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
        onSegmentCreate?.(newSegment);
        setSegmentedFigures((prev) => new Set(prev).add(idx));
        count++;
      }
    });

    console.log(`[Compose] Created ${count} individual segments`);
  }, [
    currentPage,
    selectedPage,
    deletedBlocks,
    deletedTables,
    deletedFigures,
    segmentedBlocks,
    segmentedTables,
    segmentedFigures,
    onSegmentCreate,
  ]);

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
    return bboxUnion(selectedBboxes.map((item) => item.bbox));
  }, [selectedBboxes]);

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

  // セグメント削除時にレイアウト要素のセグメント化状態を解除する処理
  const handleSegmentDelete = useCallback(
    (relatedElements?: {
      blocks: number[];
      tables: number[];
      figures: number[];
    }) => {
      if (relatedElements) {
        // 関連するブロックのセグメント化状態を解除
        setSegmentedBlocks((prev) => {
          const newSet = new Set(prev);
          relatedElements.blocks.forEach((idx: number) => {
            newSet.delete(idx);
          });
          return newSet;
        });

        // 関連するテーブルのセグメント化状態を解除
        setSegmentedTables((prev) => {
          const newSet = new Set(prev);
          relatedElements.tables.forEach((idx: number) => {
            newSet.delete(idx);
          });
          return newSet;
        });

        // 関連するフィギュアのセグメント化状態を解除
        setSegmentedFigures((prev) => {
          const newSet = new Set(prev);
          relatedElements.figures.forEach((idx: number) => {
            newSet.delete(idx);
          });
          return newSet;
        });
      }
    },
    []
  );

  // セグメント化済みとしてマーク
  const markAsSegmented = useCallback(
    (blocks: number[], tables: number[], figures: number[]) => {
      setSegmentedBlocks((prev) => new Set([...prev, ...blocks]));
      setSegmentedTables((prev) => new Set([...prev, ...tables]));
      setSegmentedFigures((prev) => new Set([...prev, ...figures]));
    },
    []
  );

  return {
    // 表示トグル
    showBlocks,
    showTables,
    showFigures,
    setShowBlocks,
    setShowTables,
    setShowFigures,

    // 選択状態
    selectedBlocks,
    selectedTables,
    selectedFigures,
    toggleBlockSelection,
    toggleTableSelection,
    toggleFigureSelection,

    // 削除状態
    deletedBlocks,
    deletedTables,
    deletedFigures,
    handleDeleteBlock,
    handleDeleteTable,
    handleDeleteFigure,

    // セグメント化状態
    segmentedBlocks,
    segmentedTables,
    segmentedFigures,
    markAsSegmented,

    // 選択要素
    selectedElements,
    selectedElementsMap,
    hasSelection,
    handleSelectAll,
    handleSelectedOrderChange,

    // セグメント作成
    handleCreateGroupSegment,
    handleCreateAllIndividualSegments,

    // bbox編集
    updateBbox,
    getEditableBbox,
    selectedBboxes,
    unionPreviewBbox,
    deletedBboxes,

    // リセット
    resetSelectionState,
    resetPageScopedState,
    handleSegmentDelete,
  };
};

