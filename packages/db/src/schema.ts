import { sql, relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Better Auth用のユーザーテーブル
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' })
    .notNull()
    .default(false),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  // Stripe連携用
  stripeCustomerId: text('stripeCustomerId').unique(),
});

// Better Auth用のセッションテーブル
export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

// Better Auth用のアカウントテーブル（OAuth）
export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt', {
    mode: 'timestamp',
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Better Auth用の検証トークンテーブル
export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Stripe製品テーブル
export const products = sqliteTable('products', {
  id: text('id').primaryKey(), // Stripe Product ID
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  name: text('name').notNull(),
  description: text('description'),
  image: text('image'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Stripe価格テーブル
export const prices = sqliteTable('prices', {
  id: text('id').primaryKey(), // Stripe Price ID
  productId: text('productId')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  currency: text('currency').notNull(),
  type: text('type', { enum: ['one_time', 'recurring'] }).notNull(),
  unitAmount: integer('unitAmount'),
  interval: text('interval', { enum: ['day', 'week', 'month', 'year'] }),
  intervalCount: integer('intervalCount'),
  trialPeriodDays: integer('trialPeriodDays'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Stripeサブスクリプションテーブル
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(), // Stripe Subscription ID
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  status: text('status', {
    enum: [
      'active',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'past_due',
      'trialing',
      'unpaid',
    ],
  }).notNull(),
  priceId: text('priceId')
    .notNull()
    .references(() => prices.id),
  quantity: integer('quantity'),
  cancelAtPeriodEnd: integer('cancelAtPeriodEnd', { mode: 'boolean' })
    .notNull()
    .default(false),
  cancelAt: integer('cancelAt', { mode: 'timestamp' }),
  canceledAt: integer('canceledAt', { mode: 'timestamp' }),
  currentPeriodStart: integer('currentPeriodStart', {
    mode: 'timestamp',
  }).notNull(),
  currentPeriodEnd: integer('currentPeriodEnd', {
    mode: 'timestamp',
  }).notNull(),
  created: integer('created', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  endedAt: integer('endedAt', { mode: 'timestamp' }),
  trialStart: integer('trialStart', { mode: 'timestamp' }),
  trialEnd: integer('trialEnd', { mode: 'timestamp' }),
  metadata: text('metadata', { mode: 'json' }),
});

// Stripe支払いテーブル（都度課金用）
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(), // Stripe PaymentIntent ID
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  status: text('status', {
    enum: [
      'succeeded',
      'processing',
      'requires_payment_method',
      'requires_confirmation',
      'requires_action',
      'canceled',
    ],
  }).notNull(),
  priceId: text('priceId').references(() => prices.id),
  productId: text('productId').references(() => products.id),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// プロジェクトテーブル（ロゴ・ブランドのバリエーション管理）
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  ownerId: text('ownerId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  visibility: text('visibility', { enum: ['private', 'public'] })
    .notNull()
    .default('private'),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// デザインテーブル（tldrawドキュメント）
export const designs = sqliteTable('designs', {
  id: text('id').primaryKey(),
  projectId: text('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  doc: text('doc', { mode: 'json' }).notNull(), // tldrawのStoreSnapshot
  thumbnailKey: text('thumbnailKey'), // R2のキー
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// アセットテーブル（画像・エクスポートファイル）
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  projectId: text('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  designId: text('designId').references(() => designs.id, {
    onDelete: 'cascade',
  }),
  key: text('key').notNull(), // R2のキー
  type: text('type', { enum: ['image', 'export'] }).notNull(),
  width: integer('width'),
  height: integer('height'),
  size: integer('size'), // バイト数
  contentType: text('contentType').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// メッセージテーブル（チャット履歴）
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  designId: text('designId')
    .notNull()
    .references(() => designs.id, { onDelete: 'cascade' }),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'system'] }).notNull(),
  content: text('content').notNull(),
  selectionIds: text('selectionIds', { mode: 'json' }), // 選択されていたshape IDの配列
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// 記事テーブル（note執筆ワークフロー用）
export const articles = sqliteTable('articles', {
  id: text('id').primaryKey(),
  authorId: text('authorId').references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: text('status', {
    enum: ['planning', 'draft', 'published'],
  })
    .notNull()
    .default('planning'),
  // 戦略メモ（ペルソナ、競合、USP、構成案）
  strategyMemo: text('strategyMemo', { mode: 'json' }).$type<{
    persona?: string;
    competitors?: Array<{ title: string; url: string; summary?: string }>;
    usp?: string;
    outline?: string[];
  }>(),
  // セクション（見出しと本文のペア）
  sections: text('sections', { mode: 'json' }).$type<
    Array<{ heading: string; body: string }>
  >(),
  // ワークフロー状態（useworkflowの進行状態）
  workflowState: text('workflowState', { mode: 'json' }),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// 型エクスポート
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Verification = typeof verification.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Price = typeof prices.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Design = typeof designs.$inferSelect;
export type NewDesign = typeof designs.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;

// リレーション定義
export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(user, {
    fields: [projects.ownerId],
    references: [user.id],
  }),
  designs: many(designs),
  assets: many(assets),
}));

export const designsRelations = relations(designs, ({ one, many }) => ({
  project: one(projects, {
    fields: [designs.projectId],
    references: [projects.id],
  }),
  messages: many(messages),
  assets: many(assets),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  design: one(designs, {
    fields: [messages.designId],
    references: [designs.id],
  }),
  user: one(user, {
    fields: [messages.userId],
    references: [user.id],
  }),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  project: one(projects, {
    fields: [assets.projectId],
    references: [projects.id],
  }),
  design: one(designs, {
    fields: [assets.designId],
    references: [designs.id],
  }),
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  author: one(user, {
    fields: [articles.authorId],
    references: [user.id],
  }),
}));
