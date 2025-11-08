// 画像アップロード用のヘルパー関数

export async function uploadImageToR2(params: {
  file: File;
  designId: string;
  purpose?: 'image' | 'thumbnail';
}): Promise<{ key: string; url: string }> {
  const { file, designId, purpose = 'image' } = params;

  // 署名URLを取得
  const response = await fetch('/api/storage/upload-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      designId,
      contentType: file.type,
      fileName: file.name,
      purpose,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get signed URL');
  }

  const { url, key } = await response.json();

  // R2にアップロード
  const uploadResponse = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload to R2');
  }

  return { key, url };
}

export async function uploadBlobToR2(params: {
  blob: Blob;
  designId: string;
  fileName: string;
  purpose?: 'image' | 'thumbnail';
}): Promise<{ key: string }> {
  const { blob, designId, fileName, purpose = 'thumbnail' } = params;

  // 署名URLを取得
  const response = await fetch('/api/storage/upload-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      designId,
      contentType: blob.type,
      fileName,
      purpose,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get signed URL');
  }

  const { url, key } = await response.json();

  // R2にアップロード
  const uploadResponse = await fetch(url, {
    method: 'PUT',
    body: blob,
    headers: {
      'Content-Type': blob.type,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload to R2');
  }

  return { key };
}

export function getPublicUrl(key: string): string {
  // R2のPublic URLを構築（環境変数から取得）
  const publicDomain = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!publicDomain) {
    throw new Error('NEXT_PUBLIC_R2_PUBLIC_URL is not set');
  }
  return `${publicDomain}/${key}`;
}

