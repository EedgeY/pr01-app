'use client';

import { useState } from 'react';
import type { NormalizedOcr } from '@workspace/ai/src/ocr/types';
import type { DetectedField } from '@workspace/ai';
import {
  availableModels,
  defaultModel,
} from '@workspace/ai/src/clients/models';
import { SchemaExportButton } from './_components/SchemaExportButton';
import { FieldSchemaDetectButton } from './_components/FieldSchemaDetectButton';
import { FileUploadSection } from './_components/FileUploadSection';
import { OcrCanvas } from './_components/OcrCanvas';
import { ContentTabs } from './_components/ContentTabs';
import { SegmentEditor } from './_components/SegmentEditor';
import { SegmentRunPanel } from './_components/SegmentRunPanel';
import { usePdfPreview } from './_hooks/usePdfPreview';
import { useSegments } from './_hooks/useSegments';

export default function OcrViewerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [ocr, setOcr] = useState<NormalizedOcr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState(0);
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

  // PDF preview hook
  const { imageUrls, generatePreview, clearPreview } = usePdfPreview();

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

  const handleFileChange = async (selectedFile: File | null) => {
    if (selectedFile) {
      setFile(selectedFile);
      setOcr(null);
      setError(null);
      setDetectedFields([]);
      clearPreview();

      // セグメントモードの場合は即座にプレビューを生成
      if (mode === 'segment') {
        await generatePreview(selectedFile);
      }
    }
  };

  const handleModeChange = async (newMode: 'ocr' | 'layout' | 'segment') => {
    setMode(newMode);

    // セグメントモードに切り替えた場合、ファイルがあればプレビューを生成
    if (newMode === 'segment' && file && imageUrls.length === 0) {
      await generatePreview(file);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dpi', '300');

      const endpoint =
        mode === 'ocr' ? '/api/ocr/ocr-only' : '/api/ocr/layout-only';

      const ocrResponse = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!ocrResponse.ok) {
        const errorData = await ocrResponse.json();
        throw new Error(
          errorData.details || errorData.error || 'OCR処理に失敗しました'
        );
      }

      const ocrData: NormalizedOcr = await ocrResponse.json();
      console.log('[OCR Viewer] Received OCR data:', {
        pages: ocrData.pages?.length,
        totalBlocks: ocrData.pages?.reduce(
          (sum, p) => sum + p.blocks.length,
          0
        ),
      });
      setOcr(ocrData);

      // 画像URLを生成（プレビュー用）
      await generatePreview(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-background text-foreground'>
      <div className='container mx-auto p-6'>
        {/* Upload Section */}
        <FileUploadSection
          file={file}
          loading={loading}
          mode={mode}
          onFileChange={handleFileChange}
          onModeChange={handleModeChange}
          onUpload={handleUpload}
        />

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
                  {/* Model Selector */}
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
