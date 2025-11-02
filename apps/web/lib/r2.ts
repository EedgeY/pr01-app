import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// Cloudflare R2 (S3 互換) クライアント
// 必要な環境変数（サーバーのみで利用）:
// - R2_ACCOUNT_ID
// - R2_ACCESS_KEY_ID
// - R2_SECRET_ACCESS_KEY
// - R2_BUCKET (例: turso-test)
// - R2_ENDPOINT (任意: 省略時は https://{ACCOUNT_ID}.r2.cloudflarestorage.com)

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function getS3Client() {
  const accountId = getRequiredEnv('R2_ACCOUNT_ID');
  const endpoint =
    process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
  const accessKeyId = getRequiredEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getRequiredEnv('R2_SECRET_ACCESS_KEY');

  return new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function buildAvatarKey(params: {
  userId: string;
  fileName?: string;
  contentType?: string;
}) {
  const { userId, fileName, contentType } = params;
  const id = randomUUID();
  let ext = '';
  if (fileName && fileName.includes('.')) {
    ext = fileName.substring(fileName.lastIndexOf('.'));
  } else if (contentType) {
    // 簡易マッピング（必要に応じて拡張）
    if (contentType === 'image/png') ext = '.png';
    else if (contentType === 'image/jpeg') ext = '.jpg';
    else if (contentType === 'image/webp') ext = '.webp';
  }
  return `avatars/${userId}/${id}${ext}`;
}

export async function getSignedPutUrl(params: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}) {
  const bucket = getRequiredEnv('R2_BUCKET');
  const s3 = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ContentType: params.contentType,
  });
  const url = await getSignedUrl(s3, command, {
    expiresIn: params.expiresInSeconds ?? 60,
  });
  return url;
}

export async function getObject(params: { key: string }) {
  const bucket = getRequiredEnv('R2_BUCKET');
  const s3 = getS3Client();
  const res = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: params.key })
  );
  return res;
}
