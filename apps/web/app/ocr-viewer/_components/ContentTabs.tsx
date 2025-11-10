'use client';

import type { NormalizedPage } from '@workspace/ai/src/ocr/types';
import type { DetectedField } from '@workspace/ai';

interface ContentTabsProps {
  page: NormalizedPage;
  detectedFields: DetectedField[];
  activeTab: 'blocks' | 'tables' | 'figures' | 'fields';
  selectedBlock: {
    type: 'block' | 'table' | 'figure' | 'field';
    index: number;
  } | null;
  onTabChange: (tab: 'blocks' | 'tables' | 'figures' | 'fields') => void;
  onBlockSelect: (selection: {
    type: 'block' | 'table' | 'figure' | 'field';
    index: number;
  } | null) => void;
}

export function ContentTabs({
  page,
  detectedFields,
  activeTab,
  selectedBlock,
  onTabChange,
  onBlockSelect,
}: ContentTabsProps) {
  const pageFields = detectedFields.filter((f) => f.pageIndex === page.pageIndex);

  return (
    <div className="bg-muted/30 rounded-lg border flex flex-col h-[600px]">
      {/* Tab Header */}
      <div className="flex border-b bg-background">
        <button
          onClick={() => onTabChange('blocks')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'blocks'
              ? 'bg-muted border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            📄 Blocks
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
              {page.blocks.length}
            </span>
          </div>
        </button>
        <button
          onClick={() => onTabChange('tables')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'tables'
              ? 'bg-muted border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            📊 Tables
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
              {page.tables?.length || 0}
            </span>
          </div>
        </button>
        <button
          onClick={() => onTabChange('figures')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'figures'
              ? 'bg-muted border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            🖼️ Figures
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
              {page.figures?.length || 0}
            </span>
          </div>
        </button>
        <button
          onClick={() => onTabChange('fields')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'fields'
              ? 'bg-muted border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            🤖 AI Fields
            <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full">
              {pageFields.length}
            </span>
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Blocks Tab */}
        {activeTab === 'blocks' && (
          <div className="space-y-2">
            {page.blocks.map((block, idx) => {
              const isSelected =
                selectedBlock?.type === 'block' && selectedBlock.index === idx;
              return (
                <div
                  key={idx}
                  onClick={() =>
                    onBlockSelect({
                      type: 'block',
                      index: idx,
                    })
                  }
                  className={`p-3 rounded border text-sm cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-red-50 border-red-500 ring-2 ring-red-200'
                      : 'bg-background hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                      {idx}
                    </span>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground font-medium mb-1">
                        {block.blockType}
                      </div>
                      <div className="line-clamp-2">{block.text || '(empty)'}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tables Tab */}
        {activeTab === 'tables' && (
          <div className="space-y-2">
            {page.tables && page.tables.length > 0 ? (
              page.tables.map((table, idx) => {
                const isSelected =
                  selectedBlock?.type === 'table' && selectedBlock.index === idx;
                return (
                  <div
                    key={idx}
                    onClick={() =>
                      onBlockSelect({
                        type: 'table',
                        index: idx,
                      })
                    }
                    className={`p-3 rounded border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-red-50 border-red-500 ring-2 ring-red-200'
                        : 'bg-background hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {idx}
                      </span>
                      <span className="font-medium">
                        {table.rows} rows × {table.cols} cols
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({table.cells.length} cells)
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-muted-foreground py-8">
                テーブルが検出されませんでした
              </div>
            )}
          </div>
        )}

        {/* Figures Tab */}
        {activeTab === 'figures' && (
          <div className="space-y-2">
            {page.figures && page.figures.length > 0 ? (
              page.figures.map((figure, idx) => {
                const isSelected =
                  selectedBlock?.type === 'figure' && selectedBlock.index === idx;
                return (
                  <div
                    key={idx}
                    onClick={() =>
                      onBlockSelect({
                        type: 'figure',
                        index: idx,
                      })
                    }
                    className={`p-3 rounded border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-red-50 border-red-500 ring-2 ring-red-200'
                        : 'bg-background hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {idx}
                      </span>
                      <span>{figure.figureType}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-muted-foreground py-8">
                図表が検出されませんでした
              </div>
            )}
          </div>
        )}

        {/* Fields Tab */}
        {activeTab === 'fields' && (
          <div className="space-y-2">
            {pageFields.length > 0 ? (
              pageFields.map((field, idx) => {
                const isSelected =
                  selectedBlock?.type === 'field' && selectedBlock.index === idx;
                return (
                  <div
                    key={idx}
                    onClick={() =>
                      onBlockSelect({
                        type: 'field',
                        index: idx,
                      })
                    }
                    className={`p-3 rounded border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-red-50 border-red-500 ring-2 ring-red-200'
                        : 'bg-background hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-mono bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                        {idx}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{field.label}</span>
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            {field.type}
                          </span>
                          {field.required && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                              必須
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>
                            キー:{' '}
                            <code className="bg-muted px-1 py-0.5 rounded">
                              {field.name}
                            </code>
                          </div>
                          <div>信頼度: {(field.confidence * 100).toFixed(0)}%</div>
                          <div className="font-mono text-[10px]">
                            bbox: [{field.bboxNormalized.x.toFixed(3)},{' '}
                            {field.bboxNormalized.y.toFixed(3)},{' '}
                            {field.bboxNormalized.w.toFixed(3)},{' '}
                            {field.bboxNormalized.h.toFixed(3)}]
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <div className="mb-2">🤖</div>
                <div>AIフィールドがまだ検出されていません</div>
                <div className="text-xs mt-2">
                  「入力欄TextSchema生成」ボタンをクリックして検出してください
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

