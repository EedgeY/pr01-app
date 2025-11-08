// client.ts はサーバーサイド専用なので、明示的に ./client からインポートする必要があります
// export * from './client'; // ← クライアントサイドでバンドルされないようにコメントアウト
export * from './schema';
export { eq, and, desc, asc } from 'drizzle-orm';
export { createClient } from '@libsql/client';
