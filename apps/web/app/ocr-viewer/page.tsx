'use client';

import { useState, useCallback } from 'react';
import type { DetectedField } from '@workspace/ai';
import { defaultModel } from '@workspace/ai/src/clients/models';
import { SchemaExportButton } from './_components/SchemaExportButton';
import { FieldSchemaDetectButton } from './_components/FieldSchemaDetectButton';
import { UploadSection } from './_components/UploadSection';
import { ErrorAlert } from './_components/ErrorAlert';
import { ModelSelect } from './_components/ModelSelect';
import { OcrCanvas } from './_components/OcrCanvas';
import { ContentTabs } from './_components/ContentTabs';
import { SegmentEditor } from './_components/SegmentEditor';
import { SegmentRunPanel } from './_components/SegmentRunPanel';
import { useOcrRequest } from './_hooks/useOcrRequest';
import { useSegments } from './_hooks/useSegments';

export default function OcrViewerPage() {
  const [mode, setMode] = useState<'ocr' | 'layout' | 'segment'>('ocr');
  const [showBlocks, setShowBlocks] = useState(true);
  const [showTables, setShowTables] = useState(true);
  const [showFigures, setShowFigures] = useState(true);
  const [showFields, setShowFields] = useState(true);
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<{
    type: 'block' | 'table' | 'figure' | 'field';
    index: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<
    'blocks' | 'tables' | 'figures' | 'fields'
  >('blocks');
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel);

  // OCR処理とプレビュー生成（外部同期）
  const {
    file,
    setFile,
    loading,
    ocr,
    error,
    selectedPage,
    setSelectedPage,
    imageUrls,
    runOcrOnly,
    runLayoutOnly,
    generatePreview,
  } = useOcrRequest({
    mode,
    onFileChange: (selectedFile) => {
      if (selectedFile) {
        setDetectedFields([]);
      }
    },
  });

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
  } = useSegments();

  const handleModeChange = useCallback(
    async (newMode: 'ocr' | 'layout' | 'segment') => {
      setMode(newMode);

      // セグメントモードに切り替えた場合、ファイルがあればプレビューを生成（外部同期）
      if (newMode === 'segment' && file && imageUrls.length === 0) {
        await generatePreview(file);
      }
    },
    [file, imageUrls.length, generatePreview]
  );

  const handleUpload = useCallback(async () => {
    if (mode === 'ocr') {
      await runOcrOnly();
    } else {
      await runLayoutOnly();
    }
  }, [mode, runOcrOnly, runLayoutOnly]);

  return (
    <div className='min-h-screen bg-background text-foreground'>
      <div className='container mx-auto p-6'>
        {/* Upload Section */}
        <UploadSection
          file={file}
          loading={loading}
          mode={mode}
          showModeSelector={true}
          onFileChange={setFile}
          onModeChange={handleModeChange}
          onExecute={handleUpload}
        />

        <ErrorAlert error={error} />

        {/* Segment Mode UI */}
        {mode === 'segment' && file && imageUrls.length > 0 && (
          <>
            {/* Page Selector for Segment Mode */}
            <div className=' mb-4'>
              <div className='flex items-center gap-3'>
                <label className='text-sm font-medium'>ページ選択:</label>
                <select
                  value={selectedPage}
                  onChange={(e) => setSelectedPage(Number(e.target.value))}
                  className='border border-input rounded-md px-3 py-1.5 text-sm bg-background'
                >
                  {imageUrls.map((_, idx) => (
                    <option key={idx} value={idx}>
                      {idx + 1} / {imageUrls.length}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6'>
              {/* Left: Segment Editor */}
              <div className='lg:col-span-2'>
                {imageUrls[selectedPage] && (
                  <SegmentEditor
                    imageUrl={imageUrls[selectedPage]!}
                    pageIndex={selectedPage}
                    segments={segments}
                    selectedId={selectedSegmentId}
                    results={results}
                    onSegmentAdd={addSegment}
                    onSegmentUpdate={updateSegment}
                    onSegmentSelect={selectSegment}
                  />
                )}
              </div>

              {/* Right: Segment Run Panel */}
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

        {ocr && mode !== 'segment' && (
          <div className='bg-card text-card-foreground rounded-lg border p-5 mb-6'>
            <div className='flex flex-col gap-4 mb-6'>
              <div className='flex items-center justify-between flex-wrap gap-3'>
                <h2 className='text-xl font-bold'>結果を表示</h2>
                <div className='flex items-center gap-3 flex-wrap'>
                  <ModelSelect value={selectedModel} onChange={setSelectedModel} />
                  <SchemaExportButton
                    blocks={ocr.pages[selectedPage]?.blocks || []}
                    disabled={!ocr.pages[selectedPage]?.blocks.length}
                  />
                  <FieldSchemaDetectButton
                    ocr={ocr}
                    imageUrl={imageUrls[selectedPage] || null}
                    selectedPage={selectedPage}
                    disabled={
                      !ocr.pages[selectedPage] || !imageUrls[selectedPage]
                    }
                    onFieldsDetected={(fields) => setDetectedFields(fields)}
                    model={selectedModel}
                  />
                  <div className='flex items-center gap-2'>
                    <label className='text-sm font-medium text-muted-foreground'>
                      Page:
                    </label>
                    <select
                      value={selectedPage}
                      onChange={(e) => setSelectedPage(Number(e.target.value))}
                      className='border border-input rounded-md px-3 py-1.5 text-sm bg-background'
                    >
                      {ocr.pages.map((_, idx) => (
                        <option key={idx} value={idx}>
                          {idx + 1} / {ocr.pages.length}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Overlay Toggles */}
              <div className='flex items-center gap-4 text-sm'>
                <span className='text-muted-foreground font-medium'>表示:</span>
                <label className='flex items-center gap-2 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={showBlocks}
                    onChange={(e) => setShowBlocks(e.target.checked)}
                    className='rounded border-input'
                  />
                  <span>Blocks</span>
                </label>
                <label className='flex items-center gap-2 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={showTables}
                    onChange={(e) => setShowTables(e.target.checked)}
                    className='rounded border-input'
                  />
                  <span>Tables</span>
                </label>
                <label className='flex items-center gap-2 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={showFigures}
                    onChange={(e) => setShowFigures(e.target.checked)}
                    className='rounded border-input'
                  />
                  <span>Figures</span>
                </label>
                <label className='flex items-center gap-2 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={showFields}
                    onChange={(e) => setShowFields(e.target.checked)}
                    className='rounded border-input'
                  />
                  <span className='text-purple-600 font-medium'>AI Fields</span>
                </label>
              </div>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              {/* Canvas Preview */}
              <div className='bg-muted/30 rounded-lg p-4 border'>
                <h3 className='text-base font-semibold mb-3'>プレビュー</h3>

                {ocr.pages[selectedPage] && imageUrls[selectedPage] && (
                  <>
                    <OcrCanvas
                      page={ocr.pages[selectedPage]}
                      imageUrl={imageUrls[selectedPage]}
                      showBlocks={showBlocks}
                      showTables={showTables}
                      showFigures={showFigures}
                      showFields={showFields}
                      detectedFields={detectedFields}
                      selectedBlock={selectedBlock}
                    />
                    <div className='mt-3 flex gap-3 text-xs text-muted-foreground'>
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
                      <span className='flex items-center gap-1.5'>
                        <span className='w-2.5 h-2.5 bg-purple-500 rounded'></span>
                        AI Fields
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Content Details - Tabbed */}
              {ocr.pages[selectedPage] && (
                <ContentTabs
                  page={ocr.pages[selectedPage]}
                  detectedFields={detectedFields}
                  activeTab={activeTab}
                  selectedBlock={selectedBlock}
                  onTabChange={setActiveTab}
                  onBlockSelect={setSelectedBlock}
                />
              )}
            </div>
          </div>
        )}

        {/* AI Fields section removed - focus on OCR quality first */}
      </div>
    </div>
  );
}
