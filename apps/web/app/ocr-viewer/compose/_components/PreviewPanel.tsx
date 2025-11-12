'use client';

import type { NormalizedOcr } from '@workspace/ai/src/ocr/types';

import { InteractiveBboxOverlay } from './InteractiveBboxOverlay';
import { OcrCanvas } from '../../_components/OcrCanvas';

type Bbox = { x: number; y: number; w: number; h: number };

type SelectedBbox = {
  bbox: Bbox;
  type: 'block' | 'table' | 'figure';
  id: string;
};

type DeletedElement = {
  bbox: Bbox;
  type: 'block' | 'table' | 'figure';
};

type PreviewPanelProps = {
  currentPage: NormalizedOcr['pages'][number] | undefined;
  imageUrl: string | undefined;
  showBlocks: boolean;
  showTables: boolean;
  showFigures: boolean;
  onToggleBlocks: (checked: boolean) => void;
  onToggleTables: (checked: boolean) => void;
  onToggleFigures: (checked: boolean) => void;
  selectedBboxes: SelectedBbox[];
  unionPreviewBbox: Bbox | null;
  deletedBboxes: DeletedElement[];
  onBboxUpdate: (id: string, bbox: Bbox) => void;
};

export function PreviewPanel({
  currentPage,
  imageUrl,
  showBlocks,
  showTables,
  showFigures,
  onToggleBlocks,
  onToggleTables,
  onToggleFigures,
  selectedBboxes,
  unionPreviewBbox,
  deletedBboxes,
  onBboxUpdate,
}: PreviewPanelProps) {
  if (!currentPage || !imageUrl) {
    return null;
  }

  return (
    <div className='bg-card rounded-lg border p-5'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-semibold'>プレビュー</h3>
        <div className='flex items-center gap-4 text-sm'>
          <span className='text-muted-foreground font-medium'>表示:</span>
          <label className='flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={showBlocks}
              onChange={(event) => onToggleBlocks(event.target.checked)}
              className='rounded border-input'
            />
            <span>Blocks</span>
          </label>
          <label className='flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={showTables}
              onChange={(event) => onToggleTables(event.target.checked)}
              className='rounded border-input'
            />
            <span>Tables</span>
          </label>
          <label className='flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={showFigures}
              onChange={(event) => onToggleFigures(event.target.checked)}
              className='rounded border-input'
            />
            <span>Figures</span>
          </label>
        </div>
      </div>

      <div className='relative bg-background rounded border overflow-hidden'>
        <OcrCanvas
          page={currentPage}
          imageUrl={imageUrl}
          showBlocks={showBlocks}
          showTables={showTables}
          showFigures={showFigures}
          showFields={false}
          detectedFields={[]}
          selectedBlock={null}
        />
        {(selectedBboxes.length > 0 || deletedBboxes.length > 0) && (
          <InteractiveBboxOverlay
            imageUrl={imageUrl}
            selectedBboxes={selectedBboxes}
            unionBbox={unionPreviewBbox}
            deletedElements={deletedBboxes}
            onBboxUpdate={onBboxUpdate}
          />
        )}
      </div>

      <div className='mt-3 flex gap-3 text-xs text-muted-foreground flex-wrap'>
        <span className='flex items-center gap-1.5'>
          <span className='w-2.5 h-2.5 bg-blue-500 rounded'></span>
          Blocks
        </span>
        <span className='flex items-center gap-1.5'>
          <span className='w-2.5 h-2.5 bg-orange-500 rounded'></span>
          Tables
        </span>
        <span className='flex items-center gap-1.5'>
          <span className='w-2.5 h-2.5 bg-green-500 rounded'></span>
          Figures
        </span>
        {selectedBboxes.length > 0 && (
          <>
            <span className='flex items-center gap-1.5'>
              <span className='w-2.5 h-2.5 bg-yellow-500 rounded'></span>
              選択中 ({selectedBboxes.length})
            </span>
            {unionPreviewBbox && selectedBboxes.length > 1 && (
              <span className='flex items-center gap-1.5'>
                <span className='w-2.5 h-2.5 bg-red-500 rounded'></span>
                グループ化範囲
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
