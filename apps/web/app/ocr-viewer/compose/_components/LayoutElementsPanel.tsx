'use client';

import { DragEvent, useState } from 'react';
import type { NormalizedOcr } from '@workspace/ai/src/ocr/types';
import { Button } from '@workspace/ui/components/button';

type SelectedElement = {
  id: string;
  label: string;
  type: 'block' | 'table' | 'figure';
  index: number;
};

type LayoutElementsPanelProps = {
  currentPage: NormalizedOcr['pages'][number] | undefined;
  selectedBlocks: Set<number>;
  selectedTables: Set<number>;
  selectedFigures: Set<number>;
  segmentedBlocks: Set<number>;
  segmentedTables: Set<number>;
  segmentedFigures: Set<number>;
  deletedBlocks: Set<number>;
  deletedTables: Set<number>;
  deletedFigures: Set<number>;
  onToggleBlock: (index: number) => void;
  onToggleTable: (index: number) => void;
  onToggleFigure: (index: number) => void;
  onDeleteBlock: (index: number) => void;
  onDeleteTable: (index: number) => void;
  onDeleteFigure: (index: number) => void;
  onSelectAll: () => void;
  onCreateAllIndividualSegments: () => void;
  onCreateGroupSegment: () => void;
  hasSelection: boolean;
  selectedElements: SelectedElement[];
  onOrderChange: (nextIds: string[]) => void;
};

export function LayoutElementsPanel({
  currentPage,
  selectedBlocks,
  selectedTables,
  selectedFigures,
  segmentedBlocks,
  segmentedTables,
  segmentedFigures,
  deletedBlocks,
  deletedTables,
  deletedFigures,
  onToggleBlock,
  onToggleTable,
  onToggleFigure,
  onDeleteBlock,
  onDeleteTable,
  onDeleteFigure,
  onSelectAll,
  onCreateAllIndividualSegments,
  onCreateGroupSegment,
  hasSelection,
  selectedElements,
  onOrderChange,
}: LayoutElementsPanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      return;
    }

    const updated = selectedElements.slice();
    const draggedItem = updated[draggedIndex];
    if (!draggedItem) return;

    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);

    onOrderChange(updated.map((item) => item.id));
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className='bg-card rounded-lg border p-5'>
      <div className='flex flex-col gap-3 mb-4'>
        <h3 className='text-lg font-semibold'>レイアウト要素</h3>
        <div className='flex flex-col gap-2'>
          <div className='flex gap-2'>
            <Button
              onClick={onSelectAll}
              variant='outline'
              size='sm'
              className='flex-1'
              disabled={!currentPage}
            >
              全選択/解除
            </Button>
          </div>
          <div className='flex gap-2'>
            <Button
              onClick={onCreateAllIndividualSegments}
              variant='secondary'
              size='sm'
              className='flex-1'
              disabled={!currentPage}
            >
              残り全てを個別セグメント化
            </Button>
          </div>
        </div>
      </div>

      {currentPage && (
        <div className='space-y-4 max-h-[500px] overflow-y-auto'>
          {currentPage.blocks.length > 0 && (
            <div>
              <h4 className='text-sm font-semibold mb-2 text-blue-600'>
                Blocks (
                {
                  currentPage.blocks.filter((_, idx) => !deletedBlocks.has(idx))
                    .length
                }
                )
              </h4>
              <div className='space-y-1'>
                {currentPage.blocks.map(
                  (block, idx) =>
                    !deletedBlocks.has(idx) && (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 p-2 rounded transition-colors ${
                          segmentedBlocks.has(idx)
                            ? 'bg-green-50 border border-green-300'
                            : selectedBlocks.has(idx)
                              ? 'bg-blue-100 border border-blue-400'
                              : 'hover:bg-muted border border-transparent'
                        }`}
                      >
                        <input
                          type='checkbox'
                          checked={selectedBlocks.has(idx)}
                          onChange={() => onToggleBlock(idx)}
                          className='mt-1 cursor-pointer'
                          disabled={segmentedBlocks.has(idx)}
                        />
                        <div className='flex-1 text-xs'>
                          <div className='flex items-center gap-2'>
                            <span className='font-medium'>Block {idx + 1}</span>
                            {segmentedBlocks.has(idx) && (
                              <span className='text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded'>
                                セグメント化済
                              </span>
                            )}
                          </div>
                          <div className='text-muted-foreground truncate'>
                            {block.text?.slice(0, 50)}
                            {(block.text?.length || 0) > 50 && '...'}
                          </div>
                          <div className='text-muted-foreground'>
                            [{block.bbox.x.toFixed(3)},{' '}
                            {block.bbox.y.toFixed(3)}, {block.bbox.w.toFixed(3)}
                            , {block.bbox.h.toFixed(3)}]
                          </div>
                        </div>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteBlock(idx);
                          }}
                          className='text-red-600 hover:text-red-800 text-xs px-2 py-1'
                          title='削除'
                        >
                          ✕
                        </button>
                      </div>
                    )
                )}
              </div>
            </div>
          )}

          {currentPage.tables && currentPage.tables.length > 0 && (
            <div>
              <h4 className='text-sm font-semibold mb-2 text-orange-600'>
                Tables (
                {
                  currentPage.tables.filter((_, idx) => !deletedTables.has(idx))
                    .length
                }
                )
              </h4>
              <div className='space-y-1'>
                {currentPage.tables.map(
                  (table, idx) =>
                    !deletedTables.has(idx) && (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 p-2 rounded transition-colors ${
                          segmentedTables.has(idx)
                            ? 'bg-green-50 border border-green-300'
                            : selectedTables.has(idx)
                              ? 'bg-orange-100 border border-orange-400'
                              : 'hover:bg-muted border border-transparent'
                        }`}
                      >
                        <input
                          type='checkbox'
                          checked={selectedTables.has(idx)}
                          onChange={() => onToggleTable(idx)}
                          className='mt-1 cursor-pointer'
                          disabled={segmentedTables.has(idx)}
                        />
                        <div className='flex-1 text-xs'>
                          <div className='flex items-center gap-2'>
                            <span className='font-medium'>Table {idx + 1}</span>
                            {segmentedTables.has(idx) && (
                              <span className='text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded'>
                                セグメント化済
                              </span>
                            )}
                          </div>
                          <div className='text-muted-foreground'>
                            {table.rows}行 × {table.cols}列
                          </div>
                          <div className='text-muted-foreground'>
                            [{table.bbox.x.toFixed(3)},{' '}
                            {table.bbox.y.toFixed(3)}, {table.bbox.w.toFixed(3)}
                            , {table.bbox.h.toFixed(3)}]
                          </div>
                        </div>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteTable(idx);
                          }}
                          className='text-red-600 hover:text-red-800 text-xs px-2 py-1'
                          title='削除'
                        >
                          ✕
                        </button>
                      </div>
                    )
                )}
              </div>
            </div>
          )}

          {currentPage.figures && currentPage.figures.length > 0 && (
            <div>
              <h4 className='text-sm font-semibold mb-2 text-green-600'>
                Figures (
                {
                  currentPage.figures.filter(
                    (_, idx) => !deletedFigures.has(idx)
                  ).length
                }
                )
              </h4>
              <div className='space-y-1'>
                {currentPage.figures.map(
                  (figure, idx) =>
                    !deletedFigures.has(idx) && (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 p-2 rounded transition-colors ${
                          segmentedFigures.has(idx)
                            ? 'bg-green-50 border border-green-300'
                            : selectedFigures.has(idx)
                              ? 'bg-green-100 border border-green-400'
                              : 'hover:bg-muted border border-transparent'
                        }`}
                      >
                        <input
                          type='checkbox'
                          checked={selectedFigures.has(idx)}
                          onChange={() => onToggleFigure(idx)}
                          className='mt-1 cursor-pointer'
                          disabled={segmentedFigures.has(idx)}
                        />
                        <div className='flex-1 text-xs'>
                          <div className='flex items-center gap-2'>
                            <span className='font-medium'>
                              Figure {idx + 1}
                            </span>
                            {segmentedFigures.has(idx) && (
                              <span className='text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded'>
                                セグメント化済
                              </span>
                            )}
                          </div>
                          <div className='text-muted-foreground'>
                            {figure.figureType}
                          </div>
                          <div className='text-muted-foreground'>
                            [{figure.bbox.x.toFixed(3)},{' '}
                            {figure.bbox.y.toFixed(3)},{' '}
                            {figure.bbox.w.toFixed(3)},{' '}
                            {figure.bbox.h.toFixed(3)}]
                          </div>
                        </div>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteFigure(idx);
                          }}
                          className='text-red-600 hover:text-red-800 text-xs px-2 py-1'
                          title='削除'
                        >
                          ✕
                        </button>
                      </div>
                    )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedElements.length > 0 && (
        <div className='mt-4 pt-4 border-t'>
          <h4 className='text-sm font-semibold mb-2'>
            選択中の要素（ドラッグで並び替え）
          </h4>
          <div className='space-y-1 mb-3 max-h-[200px] overflow-y-auto'>
            {selectedElements.map((element, index) => (
              <div
                key={element.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(event) => handleDragOver(event, index)}
                onDragEnd={handleDragEnd}
                className={`p-2 rounded border cursor-move transition-colors ${
                  draggedIndex === index
                    ? 'bg-blue-100 border-blue-400'
                    : 'bg-muted hover:bg-muted/80 border-border'
                }`}
              >
                <div className='flex items-center gap-2'>
                  <span className='text-xs font-mono text-muted-foreground'>
                    {index + 1}
                  </span>
                  <svg
                    className='w-4 h-4 text-muted-foreground'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M4 8h16M4 16h16'
                    />
                  </svg>
                  <span className='text-xs flex-1 truncate'>
                    {element.label}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      element.type === 'block'
                        ? 'bg-blue-100 text-blue-700'
                        : element.type === 'table'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {element.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className='mt-4 pt-4 border-t space-y-2'>
        <Button
          onClick={onCreateGroupSegment}
          disabled={!hasSelection}
          className='w-full'
          variant='default'
        >
          選択をグループ化（Union）
        </Button>
        {hasSelection && (
          <div className='text-xs text-muted-foreground space-y-1'>
            <p>選択中: {selectedElements.length} 要素</p>
            <p className='text-blue-600'>→ 外接矩形で1つのセグメントを作成</p>
          </div>
        )}
      </div>
    </div>
  );
}
