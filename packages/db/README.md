# @workspace/db

Turso + Drizzle ORMを使用したデータベースパッケージ。

## セットアップ

1. Tursoデータベースを作成:
```bash
turso db create <database-name>
turso db show <database-name>
```

2. 環境変数を設定（`.env.local`）:
```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

3. マイグレーションを生成:
```bash
pnpm db:generate
```

4. マイグレーションを実行:
```bash
pnpm db:migrate
```

## スクリプト

- `pnpm db:generate` - スキーマからマイグレーションを生成
- `pnpm db:migrate` - マイグレーションを実行
- `pnpm db:push` - スキーマを直接プッシュ（開発用）
- `pnpm db:studio` - Drizzle Studioを起動

## スキーマ

- `user` - ユーザー情報（Better Auth + Stripe連携）
- `session` - セッション管理
- `account` - OAuth アカウント
- `verification` - 検証トークン
- `products` - Stripe製品
- `prices` - Stripe価格
- `subscriptions` - サブスクリプション
- `payments` - 都度課金の支払い

