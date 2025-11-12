'use client';

import { useState, useCallback } from 'react';
import { defaultModel } from '@workspace/ai/src/clients/models';
import { useOcrRequest } from '../_hooks/useOcrRequest';
import { useLayoutSelection } from '../_hooks/useLayoutSelection';
import { useSegments, type Segment } from '../_hooks/useSegments';
import { SegmentRunPanel } from '../_components/SegmentRunPanel';
import { UploadSection } from '../_components/UploadSection';
import { ErrorAlert } from '../_components/ErrorAlert';
import { ModelSelect } from '../_components/ModelSelect';
import { PageSelector } from './_components/PageSelector';
import { PreviewPanel } from './_components/PreviewPanel';
import { LayoutElementsPanel } from './_components/LayoutElementsPanel';

/**
 * レイアウト支援セグメント化ルート
 * フロー: レイアウトOCR → ユーザーが bbox を選択/グルーピング（Union）してセグメント生成 → 既存セグメント処理（OCR-only→LLM） → 結果統合/提示
 */
export default function ComposeOcrPage() {
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel);

  // OCR処理とプレビュー生成（外部同期）
  const {
    file,
    setFile,
    loading,
    ocr: layoutOcr,
    error,
    setError,
    selectedPage,
    setSelectedPage,
    imageUrls,
    runLayoutOnly,
  } = useOcrRequest({ mode: 'layout' });

  const currentPage = layoutOcr?.pages[selectedPage];

  // レイアウト選択状態管理
  const layout = useLayoutSelection({
    currentPage,
    selectedPage,
    onSegmentCreate: undefined, // 後で設定
  });

  // セグメント削除時にレイアウト要素のセグメント化状態を解除する処理
  const handleSegmentDelete = useCallback(
    (segment: Segment) => {
      layout.handleSegmentDelete(segment.relatedElements);
    },
    [layout]
  );

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

  // レイアウト選択のonSegmentCreateを設定
  const layoutWithSegmentCreate = {
    ...layout,
    handleCreateGroupSegment: useCallback(() => {
      try {
        layout.handleCreateGroupSegment();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }, [layout, setError]),
  };

  // onSegmentCreateを再設定
  const handleCreateGroupSegment = useCallback(() => {
    if (!currentPage) return;

    const bboxes: Array<{ x: number; y: number; w: number; h: number }> = [];

    // 選択されたブロックのbboxを収集
    layout.selectedBlocks.forEach((idx) => {
      const block = currentPage.blocks[idx];
      if (block) {
        bboxes.push(block.bbox);
      }
    });

    // 選択されたテーブルのbboxを収集
    layout.selectedTables.forEach((idx) => {
      const table = currentPage.tables?.[idx];
      if (table) {
        bboxes.push(table.bbox);
      }
    });

    // 選択されたフィギュアのbboxを収集
    layout.selectedFigures.forEach((idx) => {
      const figure = currentPage.figures?.[idx];
      if (figure) {
        bboxes.push(figure.bbox);
      }
    });

    if (bboxes.length === 0) {
      setError('要素を選択してください');
      return;
    }

    const unionBbox = bboxes.reduce(
      (acc, bbox) => {
        if (!acc) return bbox;
        const minX = Math.min(acc.x, bbox.x);
        const minY = Math.min(acc.y, bbox.y);
        const maxX = Math.max(acc.x + acc.w, bbox.x + bbox.w);
        const maxY = Math.max(acc.y + acc.h, bbox.y + bbox.h);
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      },
      null as { x: number; y: number; w: number; h: number } | null
    );

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
        blocks: [...layout.selectedBlocks],
        tables: [...layout.selectedTables],
        figures: [...layout.selectedFigures],
      },
    };

    addSegment(newSegment);

    // セグメント化済みとしてマーク
    layout.markAsSegmented(
      [...layout.selectedBlocks],
      [...layout.selectedTables],
      [...layout.selectedFigures]
    );

    // 選択をクリア
    layout.resetSelectionState();
  }, [currentPage, selectedPage, layout, addSegment, setError]);

  const handleCreateAllIndividualSegments = useCallback(() => {
    if (!currentPage) return;

    let count = 0;
    const segmentedBlocksArr: number[] = [];
    const segmentedTablesArr: number[] = [];
    const segmentedFiguresArr: number[] = [];

    // 未セグメント化・未削除のブロックを個別セグメント化
    currentPage.blocks.forEach((block, idx) => {
      if (!layout.deletedBlocks.has(idx) && !layout.segmentedBlocks.has(idx)) {
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
        segmentedBlocksArr.push(idx);
        count++;
      }
    });

    // 未セグメント化・未削除のテーブルを個別セグメント化
    currentPage.tables?.forEach((table, idx) => {
      if (!layout.deletedTables.has(idx) && !layout.segmentedTables.has(idx)) {
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
        segmentedTablesArr.push(idx);
        count++;
      }
    });

    // 未セグメント化・未削除のフィギュアを個別セグメント化
    currentPage.figures?.forEach((figure, idx) => {
      if (
        !layout.deletedFigures.has(idx) &&
        !layout.segmentedFigures.has(idx)
      ) {
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
        segmentedFiguresArr.push(idx);
        count++;
      }
    });

    // セグメント化済みとしてマーク
    layout.markAsSegmented(
      segmentedBlocksArr,
      segmentedTablesArr,
      segmentedFiguresArr
    );

    console.log(`[Compose] Created ${count} individual segments`);
  }, [currentPage, selectedPage, layout, addSegment]);

  const handlePageChange = useCallback(
    (pageIndex: number) => {
      setSelectedPage(pageIndex);
      layout.resetPageScopedState();
    },
    [setSelectedPage, layout]
  );

  return (
    <div className='min-h-screen bg-background text-foreground'>
      <div className=' mx-auto p-6'>
        {/* アップロードセクション */}
        <UploadSection
          file={file}
          loading={loading}
          mode='layout'
          onFileChange={setFile}
          onExecute={runLayoutOnly}
        />

        {/* エラー表示 */}
        <ErrorAlert error={error} />

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
              <ModelSelect value={selectedModel} onChange={setSelectedModel} />
            </div>

            <div className='grid grid-cols-4  gap-6 mb-6'>
              {/* 左: プレビュー */}
              <div className='lg:col-span-2'>
                <PreviewPanel
                  currentPage={currentPage}
                  imageUrl={imageUrls[selectedPage]}
                  showBlocks={layout.showBlocks}
                  showTables={layout.showTables}
                  showFigures={layout.showFigures}
                  onToggleBlocks={layout.setShowBlocks}
                  onToggleTables={layout.setShowTables}
                  onToggleFigures={layout.setShowFigures}
                  selectedBboxes={layout.selectedBboxes}
                  unionPreviewBbox={layout.unionPreviewBbox}
                  deletedBboxes={layout.deletedBboxes}
                  onBboxUpdate={layout.updateBbox}
                />
              </div>

              {/* 右: レイアウト要素一覧 */}
              <div className='lg:col-span-1'>
                <LayoutElementsPanel
                  currentPage={currentPage}
                  selectedBlocks={layout.selectedBlocks}
                  selectedTables={layout.selectedTables}
                  selectedFigures={layout.selectedFigures}
                  segmentedBlocks={layout.segmentedBlocks}
                  segmentedTables={layout.segmentedTables}
                  segmentedFigures={layout.segmentedFigures}
                  deletedBlocks={layout.deletedBlocks}
                  deletedTables={layout.deletedTables}
                  deletedFigures={layout.deletedFigures}
                  onToggleBlock={layout.toggleBlockSelection}
                  onToggleTable={layout.toggleTableSelection}
                  onToggleFigure={layout.toggleFigureSelection}
                  onToggleDeleteBlock={layout.handleDeleteBlock}
                  onToggleDeleteTable={layout.handleDeleteTable}
                  onToggleDeleteFigure={layout.handleDeleteFigure}
                  onSelectAll={layout.handleSelectAll}
                  onCreateAllIndividualSegments={
                    handleCreateAllIndividualSegments
                  }
                  onCreateGroupSegment={handleCreateGroupSegment}
                  hasSelection={layout.hasSelection}
                  selectedElements={layout.selectedElements}
                  onOrderChange={layout.handleSelectedOrderChange}
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
