'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Editor } from 'tldraw';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Send, MessageSquare, User, Bot } from 'lucide-react';
import { appendMessage } from '../actions';
import type { Message } from '@workspace/db/types';

interface ChatPanelProps {
  designId: string;
  editor: Editor | null;
  messages: Message[];
  onMessageSent: (message: Message) => void;
}

export function ChatPanel({
  designId,
  editor,
  messages,
  onMessageSent,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 選択されているshapeを監視
  useEffect(() => {
    if (!editor) return;

    const updateSelection = () => {
      const selected = editor.getSelectedShapeIds();
      setSelectedShapeIds(selected);
    };

    updateSelection();

    const cleanup = editor.store.listen(() => {
      updateSelection();
    });

    return cleanup;
  }, [editor]);

  // メッセージが追加されたらスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cmd+Enter でフォーカス & 送信
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (document.activeElement !== inputRef.current) {
          inputRef.current?.focus();
        } else if (input.trim()) {
          handleSendMessage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [input]);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isSending) return;

    try {
      setIsSending(true);
      const content = input.trim();
      const selectionIds =
        selectedShapeIds.length > 0 ? selectedShapeIds : undefined;

      const result = await appendMessage({
        designId,
        content,
        selectionIds,
        role: 'user',
      });

      // 新しいメッセージをローカルに追加
      const newMessage: Message = {
        id: result.id,
        designId,
        userId: '', // クライアントでは不要
        role: 'user',
        content,
        selectionIds: selectionIds || null,
        createdAt: new Date(),
      };

      onMessageSent(newMessage);
      setInput('');

      // TODO: AI連携はここで呼び出す（将来実装）
      // const aiResponse = await callAI({ content, selectionIds });
      // onMessageSent(aiResponse);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, selectedShapeIds, designId, onMessageSent]);

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <div className='h-full flex flex-col bg-white'>
      {/* ヘッダー */}
      <div className='p-4 border-b border-gray-200'>
        <div className='flex items-center gap-2'>
          <MessageSquare className='h-5 w-5 text-gray-600' />
          <h2 className='text-sm font-semibold text-gray-900'>チャット</h2>
        </div>
        {selectedShapeIds.length > 0 && (
          <div className='mt-2 text-xs text-blue-600'>
            {selectedShapeIds.length} 個の要素を選択中
          </div>
        )}
      </div>

      {/* メッセージリスト */}
      <div className='flex-1 overflow-y-auto p-4 space-y-4'>
        {messages.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-full text-center text-sm text-gray-400'>
            <MessageSquare className='h-12 w-12 mb-2 text-gray-300' />
            <p>メッセージを送信して</p>
            <p>デザインを始めましょう</p>
            <p className='mt-4 text-xs'>⌘ + Enter で入力</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'flex-row' : 'flex-row-reverse'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-green-100 text-green-600'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className='h-4 w-4' />
                  ) : (
                    <Bot className='h-4 w-4' />
                  )}
                </div>
                <div className='flex-1 space-y-1'>
                  <div
                    className={`rounded-lg p-3 text-sm ${
                      message.role === 'user'
                        ? 'bg-blue-50 text-gray-900'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {message.content}
                  </div>
                  <div className='text-xs text-gray-400 px-1'>
                    {formatTime(message.createdAt)}
                  </div>
                  {message.selectionIds &&
                    Array.isArray(message.selectionIds) && (
                      <div className='text-xs text-gray-400 px-1'>
                        🎯 {message.selectionIds.length} 個の要素
                      </div>
                    )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 入力欄 */}
      <div className='p-4 border-t border-gray-200'>
        <div className='flex gap-2'>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder='アイデアを入力してください...'
            disabled={isSending}
            className='flex-1'
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isSending}
            size='sm'
            className='px-4'
          >
            {isSending ? (
              <span className='text-xs'>送信中...</span>
            ) : (
              <>
                <Send className='h-4 w-4 mr-1' />
                Run
              </>
            )}
          </Button>
        </div>
        <div className='mt-2 text-xs text-gray-400'>
          ⌘ + Enter でフォーカス/送信 | Enter で送信
        </div>
      </div>
    </div>
  );
}
