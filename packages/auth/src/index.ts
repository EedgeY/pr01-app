import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { db } from '@workspace/db/client';
import * as schema from '@workspace/db/schema';

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET is not set');
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: process.env.AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // 本番環境では true に設定
  },
  socialProviders: {
    google: {
      clientId: process.env.OAUTH_GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET || '',
      enabled: !!(
        process.env.OAUTH_GOOGLE_CLIENT_ID &&
        process.env.OAUTH_GOOGLE_CLIENT_SECRET
      ),
    },
    github: {
      clientId: process.env.OAUTH_GITHUB_CLIENT_ID || '',
      clientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET || '',
      enabled: !!(
        process.env.OAUTH_GITHUB_CLIENT_ID &&
        process.env.OAUTH_GITHUB_CLIENT_SECRET
      ),
    },
  },
  // ユーザー作成時のフック（Stripe顧客IDの作成は後でStripeパッケージから呼び出す）
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // サインアップ後のフック
      if (ctx.path.startsWith('/sign-up')) {
        const newSession = ctx.context.newSession;
        if (newSession) {
          // Stripe顧客作成はアプリケーション層で行う
          // ここでは基本的なログのみ
          console.log('New user created:', newSession.user.id);
        }
      }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;

// better-auth/next-jsからの再エクスポート
export { toNextJsHandler } from 'better-auth/next-js';
