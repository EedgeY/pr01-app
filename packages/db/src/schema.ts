import { sql } from 'drizzle-orm';
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
