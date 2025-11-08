'use client';

import { useState, useEffect } from 'react';
import { Editor, TLShapeId, TLShape, toRichText } from 'tldraw';
import { Button } from '@workspace/ui/components/button';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Image as ImageIcon,
  Type,
  Square,
  Circle,
  Layers,
  Lightbulb,
} from 'lucide-react';
// クライアントコンポーネントでは、ブラウザのcrypto.randomUUID()を使用

interface LayerPanelProps {
  editor: Editor | null;
}

export function LayerPanel({ editor }: LayerPanelProps) {
  const [shapes, setShapes] = useState<TLShape[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<TLShapeId>>(new Set());
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    if (!editor) return;

    const updateShapes = () => {
      const allShapes = editor.getCurrentPageShapes();
      setShapes(allShapes);
      const selected = editor.getSelectedShapeIds();
      setSelectedIds(new Set(selected));
    };

    updateShapes();

    // 変更を監視
    const cleanup = editor.store.listen(() => {
      updateShapes();
    });

    return cleanup;
  }, [editor]);

  const getShapeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <Type className='h-4 w-4' />;
      case 'image':
        return <ImageIcon className='h-4 w-4' />;
      case 'geo':
        return <Square className='h-4 w-4' />;
      case 'thin-rectangle':
        return <Square className='h-4 w-4' />;
      case 'thin-circle':
        return <Circle className='h-4 w-4' />;
      case 'draw':
        return <Circle className='h-4 w-4' />;
      default:
        return <Layers className='h-4 w-4' />;
    }
  };

  // richTextからテキストを抽出するヘルパー関数
  const extractTextFromRichText = (richText: any): string => {
    if (!richText || typeof richText !== 'object') return '';
    if (typeof richText === 'string') return richText;

    // TipTap形式のrichTextからテキストを再帰的に抽出
    if (richText.content && Array.isArray(richText.content)) {
      return richText.content
        .map((node: any) => {
          if (node.type === 'text' && node.text) {
            return node.text;
          }
          if (node.content) {
            return extractTextFromRichText(node);
          }
          return '';
        })
        .join('');
    }

    return '';
  };

  const getShapeName = (shape: TLShape) => {
    if (shape.type === 'text') {
      const richText = (shape.props as any).richText;
      const text = richText ? extractTextFromRichText(richText) : '';
      return text.substring(0, 30) || 'Text';
    }
    return shape.type.charAt(0).toUpperCase() + shape.type.slice(1);
  };

  const handleSelectShape = (id: TLShapeId) => {
    if (!editor) return;
    editor.select(id);
  };

  const handleToggleVisibility = (shape: TLShape) => {
    if (!editor) return;
    editor.updateShape({
      ...shape,
    });
  };

  const handleToggleLock = (shape: TLShape) => {
    if (!editor) return;
    editor.updateShape({
      ...shape,
      isLocked: !shape.isLocked,
    });
  };

  const handleDeleteShape = (id: TLShapeId) => {
    if (!editor) return;
    editor.deleteShape(id);
  };

  return (
    <div className='h-full flex flex-col'>
      {/* ヘッダー */}
      <div className='p-4 border-b border-gray-200'>
        <div className='flex items-center justify-between mb-3'>
          <h2 className='text-sm font-semibold text-gray-900'>レイヤー</h2>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setShowTemplates(!showTemplates)}
            className='h-8 gap-2'
          >
            <Lightbulb className='h-4 w-4' />
            {showTemplates ? 'レイヤー' : 'テンプレート'}
          </Button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className='flex-1 overflow-y-auto'>
        {showTemplates ? (
          <TemplatesPanel editor={editor} />
        ) : (
          <div className='p-2 space-y-1'>
            {shapes.length === 0 ? (
              <div className='p-8 text-center text-sm text-gray-400'>
                まだ図形がありません
              </div>
            ) : (
              shapes.map((shape) => (
                <div
                  key={shape.id}
                  className={`flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer ${
                    selectedIds.has(shape.id) ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleSelectShape(shape.id)}
                >
                  <div className='text-gray-600'>
                    {getShapeIcon(shape.type)}
                  </div>
                  <div className='flex-1 text-sm text-gray-700 truncate'>
                    {getShapeName(shape)}
                  </div>
                  <div className='flex items-center gap-1'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleVisibility(shape);
                      }}
                      className='h-6 w-6 p-0'
                    >
                      {shape.opacity === 0 ? (
                        <EyeOff className='h-3 w-3' />
                      ) : (
                        <Eye className='h-3 w-3' />
                      )}
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLock(shape);
                      }}
                      className='h-6 w-6 p-0'
                    >
                      {shape.isLocked ? (
                        <Lock className='h-3 w-3' />
                      ) : (
                        <Unlock className='h-3 w-3' />
                      )}
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteShape(shape.id);
                      }}
                      className='h-6 w-6 p-0 text-red-600 hover:text-red-700'
                    >
                      <Trash2 className='h-3 w-3' />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplatesPanel({ editor }: { editor: Editor | null }) {
  const addTextBox = () => {
    if (!editor) return;
    const viewportCenter = editor.getViewportScreenCenter();
    const pageCenter = editor.screenToPage(viewportCenter);
    // IDを明示的に指定（tldrawではシェイプIDは必ず"shape:"で始まる必要がある）
    const shapeId = `shape:${crypto.randomUUID()}` as TLShapeId;
    editor.createShape({
      id: shapeId,
      type: 'text',
      x: pageCenter.x - 100,
      y: pageCenter.y - 25,
      props: {
        size: 'l',
        font: 'sans',
        color: 'black',
        textAlign: 'start',
        autoSize: true,
        richText: toRichText('Welcome to Lovart,'),
      },
    });
    // テキストシェイプを作成後、編集モードに入れる
    editor.setEditingShape(shapeId);
  };

  const addRectangle = () => {
    if (!editor) return;
    const { x, y } = editor.getViewportScreenCenter();
    editor.createShape({
      type: 'thin-rectangle',
      x: x - 100,
      y: y - 100,

      props: {
        w: 200,
        h: 200,
        fill: 'solid',
        color: 'black',
        opacity: 0.2,
      },
    });
  };

  const addCircle = () => {
    if (!editor) return;
    const { x, y } = editor.getViewportScreenCenter();
    editor.createShape({
      type: 'thin-circle',
      x: x - 100,
      y: y - 100,
      props: {
        w: 200,
        h: 200,
        fill: 'solid',
        color: 'light-blue',
      },
    });
  };

  const addLogoStamp = () => {
    if (!editor) return;
    const { x, y } = editor.getViewportScreenCenter();

    // 円を作成（tldrawではシェイプIDは必ず"shape:"で始まる必要がある）
    const circleId = `shape:${crypto.randomUUID()}` as TLShapeId;
    editor.createShape({
      id: circleId,
      type: 'geo',
      x: x - 60,
      y: y - 60,
      props: {
        w: 120,
        h: 120,
        geo: 'ellipse',
        fill: 'solid',
        color: 'black',
      },
    });

    // テキスト "-LO" を作成
    // Tldraw v4では、テキストシェイプを作成した後、編集モードに入れるか、
    // または updateShape でテキストを設定する必要があります
    // ここでは、テキストなしで作成し、その後 updateShape でテキストを設定します
    const textId = `shape:${crypto.randomUUID()}` as TLShapeId;
    editor.createShape({
      id: textId,
      type: 'text',
      x: x - 40,
      y: y - 20,
      props: {
        size: 'xl',
        font: 'sans',
        color: 'white',
        textAlign: 'start',
        autoSize: true,
      },
    });
    // テキストを設定するために、編集モードに入れる
    // または、updateShape を使用してテキストを設定できますが、
    // v4では直接テキストを設定できないため、編集モードに入れます
    editor.setEditingShape(textId);
  };

  const templates = [
    { name: 'テキスト', icon: Type, onClick: addTextBox },
    { name: '矩形', icon: Square, onClick: addRectangle },
    { name: '円', icon: Circle, onClick: addCircle },
    { name: 'ロゴスタンプ', icon: ImageIcon, onClick: addLogoStamp },
  ];

  return (
    <div className='p-4 space-y-2'>
      <div className='mb-4'>
        <h3 className='text-xs font-semibold text-gray-500 uppercase mb-2'>
          基本図形
        </h3>
        <div className='grid grid-cols-2 gap-2'>
          {templates.map((template) => (
            <Button
              key={template.name}
              variant='outline'
              onClick={template.onClick}
              className='h-20 flex flex-col items-center justify-center gap-2'
            >
              <template.icon className='h-6 w-6' />
              <span className='text-xs'>{template.name}</span>
            </Button>
          ))}
        </div>
      </div>

      <div>
        <h3 className='text-xs font-semibold text-gray-500 uppercase mb-2'>
          ブランドプリセット
        </h3>
        <div className='space-y-2'>
          <div className='p-3 bg-white border border-gray-200 rounded'>
            <div className='text-xs font-medium mb-1'>カラーパレット</div>
            <div className='flex gap-1'>
              <div className='w-6 h-6 rounded bg-black' title='Black' />
              <div className='w-6 h-6 rounded bg-green-200' title='Mint' />
              <div className='w-6 h-6 rounded bg-green-500' title='Green' />
            </div>
          </div>
          <div className='p-3 bg-white border border-gray-200 rounded'>
            <div className='text-xs font-medium mb-1'>フォント</div>
            <div className='text-sm'>Inter (Bold)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
