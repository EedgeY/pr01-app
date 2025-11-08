'use client';

import { useState, useCallback, useEffect } from 'react';
import { Tldraw, Editor, TLStoreSnapshot } from 'tldraw';
import 'tldraw/tldraw.css';
import { LayerPanel } from './layer-panel';
import { ChatPanel } from './chat-panel';
import { StatusBar } from './status-bar';
import { DistanceGuides } from './distance-guides';
import { saveDesign, saveAsset } from '../actions';
import type { Message } from '@workspace/db/types';
import { uploadImageToR2, uploadBlobToR2 } from '@/lib/image-upload';
import { getBlankTemplate } from '@/lib/tldraw-templates';
import { customShapeUtils } from '@/lib/custom-shapes';

interface EditorCanvasProps {
  designId: string;
  projectId: string;
  initialDoc: unknown;
  initialMessages: Message[];
  designName: string;
}

export function EditorCanvas({
  designId,
  projectId,
  initialDoc,
  initialMessages,
  designName,
}: EditorCanvasProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [snapshot, setSnapshot] = useState<TLStoreSnapshot | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  // スナップショットの初期化
  useEffect(() => {
    if (!initialDoc) {
      // 初期ドキュメントがない場合は空白テンプレートを使用
      setSnapshot(getBlankTemplate() as TLStoreSnapshot);
      return;
    }

    // Tldrawコンポーネントが自動的にマイグレーションを処理するため、
    // スナップショットをそのまま使用します
    // エラーが発生した場合は、エラーバウンダリまたはonErrorで処理します
    setSnapshot(initialDoc as TLStoreSnapshot);
  }, [initialDoc]);

  // エディターがマウントされた後にウェルカムテンプレートのテキストを追加
  // 注意: この処理は新規作成時のみ実行されるべきですが、
  // テンプレート内でテキストシェイプを正しい形式で作成することで回避します

  // 自動保存（デバウンス）
  const handleSave = useCallback(
    async (snapshot?: TLStoreSnapshot) => {
      if (!editor && !snapshot) return;

      try {
        setIsSaving(true);
        const doc = snapshot || editor?.store.getStoreSnapshot();
        await saveDesign({ id: designId, doc });
        setLastSaved(new Date());
      } catch (error) {
        console.error('Failed to save:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [editor, designId]
  );

  // Cmd+S で保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleMessageSent = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  // 画像ドロップハンドラー
  const handleImageDrop = useCallback(
    async (file: File) => {
      if (!editor) return;

      try {
        // R2にアップロード
        const { key } = await uploadImageToR2({
          file,
          designId,
          purpose: 'image',
        });

        // アセットを保存
        await saveAsset({
          projectId,
          designId,
          key,
          type: 'image',
          contentType: file.type,
        });

        // tldrawにアセットとして追加
        const assetId = `image:${crypto.randomUUID()}` as any;
        const img = new Image();
        const blobUrl = URL.createObjectURL(file);
        img.src = blobUrl;

        img.onload = () => {
          editor.createAssets([
            {
              id: assetId,
              type: 'image',
              typeName: 'asset',
              props: {
                name: file.name,
                src: blobUrl,
                w: img.width,
                h: img.height,
                mimeType: file.type,
                isAnimated: false,
              },
              meta: {},
            },
          ]);

          // キャンバス中央に画像シェイプを作成
          const viewportCenter = editor.getViewportScreenCenter();
          const pageCenter = editor.screenToPage(viewportCenter);
          editor.createShape({
            type: 'image',
            x: pageCenter.x - img.width / 2,
            y: pageCenter.y - img.height / 2,
            props: {
              assetId,
              w: img.width,
              h: img.height,
            },
          });
        };
      } catch (error) {
        console.error('Failed to upload image:', error);
      }
    },
    [editor, designId, projectId]
  );

  // エクスポートハンドラー
  const handleExport = useCallback(async () => {
    if (!editor) return;

    try {
      // 選択された範囲をエクスポート（なければ全体）
      const shapeIds = editor.getSelectedShapeIds();
      const ids = Array.from(
        shapeIds.length > 0 ? shapeIds : editor.getCurrentPageShapeIds()
      );

      // SVGとして取得してcanvasに変換
      const svg = await editor.getSvgString(ids, { background: true });
      if (!svg) {
        throw new Error('Failed to get SVG');
      }

      // SVGをblobに変換
      const svgBlob = new Blob([svg.svg], { type: 'image/svg+xml' });

      // 仮のPNG作成（実際はcanvasで変換が必要）
      // 簡易的にSVGをダウンロード
      const url = URL.createObjectURL(svgBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lovart-${Date.now()}.svg`;
      a.click();
      URL.revokeObjectURL(url);

      // TODO: SVG→PNG変換を実装
      // R2への保存は後で実装
    } catch (error) {
      console.error('Failed to export:', error);
    }
  }, [editor, designId, projectId]);

  return (
    <div className='flex h-full w-full bg-white'>
      {/* 左パネル */}
      {leftPanelOpen && (
        <div className='w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto shrink-0'>
          <LayerPanel editor={editor} />
        </div>
      )}

      {/* 中央キャンバス */}
      <div className='flex-1 flex flex-col relative'>
        {snapshot ? (
          <div className='flex-1 relative'>
            <Tldraw
              hideUi
              snapshot={snapshot}
              shapeUtils={customShapeUtils}
              onMount={(editor) => {
                setEditor(editor);
                setLoadError(null);
              }}
            />
            {/* 距離ガイドラインオーバーレイ */}
            <DistanceGuides editor={editor} />
          </div>
        ) : (
          <div className='flex items-center justify-center h-full'>
            <p className='text-gray-500'>Loading editor...</p>
          </div>
        )}

        {/* ステータスバー */}
        <StatusBar
          isSaving={isSaving}
          lastSaved={lastSaved}
          onSave={() => handleSave()}
          onExport={handleExport}
          leftPanelOpen={leftPanelOpen}
          onToggleLeftPanel={() => setLeftPanelOpen(!leftPanelOpen)}
          rightPanelOpen={rightPanelOpen}
          onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
          designName={designName}
        />
      </div>

      {/* 右パネル（チャット） */}
      {rightPanelOpen && (
        <div className='w-96 border-l border-gray-200 bg-white overflow-hidden shrink-0'>
          <ChatPanel
            designId={designId}
            editor={editor}
            messages={messages}
            onMessageSent={handleMessageSent}
          />
        </div>
      )}
    </div>
  );
}
