"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@workspace/ui/components/button';
import { CustomAvatarCropper } from './custom-avatar-cropper';

export function AvatarUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const router = useRouter();

  async function onUpload() {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      // 1) 署名URLを取得
      const createRes = await fetch('/api/avatar/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: file.type,
          contentLength: file.size,
          fileName: file.name,
        }),
      });
      if (!createRes.ok) throw new Error('アップロードURLの作成に失敗しました');
      const { uploadUrl, key } = await createRes.json();

      // 2) 直接PUTアップロード
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error('direct-put-failed');

      // 3) 完了処理（メタ保存＆ユーザー更新）
      const completeRes = await fetch('/api/avatar/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, contentType: file.type, size: file.size }),
      });
      if (!completeRes.ok) throw new Error('完了処理に失敗しました');

      setFile(null);
      router.refresh();
    } catch (e: any) {
      // 直PUT失敗時はサーバー経由にフォールバック
      if (e?.message === 'direct-put-failed' || e?.name === 'TypeError') {
        try {
          const form = new FormData();
          form.append('file', file as Blob);
          const res = await fetch('/api/avatar/upload', { method: 'POST', body: form });
          if (!res.ok) throw new Error('server-upload-failed');
          setFile(null);
          router.refresh();
          return;
        } catch (err: any) {
          setError(err?.message || 'アップロードに失敗しました');
        }
      } else {
        setError(e?.message || 'アップロードに失敗しました');
      }
    } finally {
      setIsUploading(false);
    }
  }

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    setSelectedFile(f);
    setShowCropper(true);
  }

  async function handleCroppedImage(cropped: File) {
    setShowCropper(false);
    setSelectedFile(null);
    setFile(cropped);
    await onUpload();
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onSelect}
      />
      <Button onClick={onUpload} disabled={!file || isUploading}>
        {isUploading ? 'アップロード中...' : '画像をアップロード'}
      </Button>
      {error && <span className="text-sm text-red-600">{error}</span>}
      {showCropper && selectedFile && (
        <CustomAvatarCropper
          file={selectedFile}
          onCancel={() => {
            setShowCropper(false);
            setSelectedFile(null);
          }}
          onCropped={handleCroppedImage}
        />
      )}
    </div>
  );
}


