import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { resolve } from 'path';

// apps/web/.env.localから環境変数を読み込む
config({ path: resolve(__dirname, '../../apps/web/.env.local') });

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    accountId: process.env.TURSO_ACCOUNT_ID!,
    databaseId: process.env.TURSO_DATABASE_ID!,
    token: process.env.TURSO_AUTH_TOKEN!,
  },
});
