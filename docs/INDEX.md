# ドキュメント一覧

このプロジェクトのドキュメントをまとめています。

## はじめに

- **[QUICKSTART.md](../QUICKSTART.md)** - 10分でセットアップ完了！最速スタートガイド
- **[README.md](../README.md)** - プロジェクト概要と基本的な使い方
- **[SETUP.md](../SETUP.md)** - 詳細なセットアップ手順

## 認証

- **[OAUTH_SETUP.md](./OAUTH_SETUP.md)** - Google/GitHub OAuth認証の設定手順
  - OAuth同意画面の設定
  - 認証情報の作成
  - 環境変数の設定
  - トラブルシューティング
  - セキュリティのベストプラクティス

## Stripe決済

- **[STRIPE_SETUP.md](../STRIPE_SETUP.md)** - Stripe設定の詳細手順
  - Stripeダッシュボードでの製品作成
  - APIキーの取得
  - Stripe CLIの使い方
  - 環境変数の設定
  
- **[STRIPE_TEST_GUIDE.md](../STRIPE_TEST_GUIDE.md)** - Stripe決済のテスト手順
  - サブスクリプション購入フロー
  - 都度課金フロー
  - サブスクリプション管理
  - トラブルシューティング
  - テストカード一覧

## 開発ガイド

### アーキテクチャ

プロジェクト構成:
```
template-turso-mono/
├── apps/
│   └── web/              # Next.jsアプリケーション
│       ├── app/          # App Router
│       │   ├── (auth)/   # 認証ページ
│       │   ├── api/      # APIルート
│       │   ├── dashboard/# ダッシュボード
│       │   └── pricing/  # 料金プラン
│       └── middleware.ts # 認証ミドルウェア
├── packages/
│   ├── db/               # Turso + Drizzle
│   ├── auth/             # Better Auth
│   ├── stripe/           # Stripe決済
│   └── ui/               # UIコンポーネント
└── scripts/              # ユーティリティスクリプト
```

### 主要な機能

#### 認証 (Better Auth)
- Email/Password認証
- OAuth（Google/GitHub）
- セッション管理
- ミドルウェアによる保護

#### データベース (Turso + Drizzle)
- SQLiteベースのエッジDB
- 型安全なORM
- マイグレーション管理
- Drizzle Studio（GUI）

#### 決済 (Stripe)
- サブスクリプション（月額/年額）
- 都度課金
- Webhook統合
- Billing Portal

#### UI (shadcn/ui)
- モダンなコンポーネント
- Tailwind CSS
- ダークモード対応
- レスポンシブデザイン

## よく使うコマンド

```bash
# 開発
pnpm dev                  # 開発サーバー起動
pnpm build                # プロダクションビルド
pnpm lint                 # リント実行

# データベース
pnpm db:push              # スキーマをプッシュ
pnpm db:generate          # マイグレーション生成
pnpm db:migrate           # マイグレーション実行
pnpm db:studio            # Drizzle Studio起動

# Stripe
pnpm stripe:check         # Stripe設定チェック
pnpm stripe:listen        # Webhook転送開始
```

## トラブルシューティング

### 一般的な問題

#### 1. 依存関係のエラー
```bash
# node_modulesを削除して再インストール
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

#### 2. ビルドエラー
```bash
# キャッシュをクリア
rm -rf .turbo apps/*/.next
pnpm build
```

#### 3. 型エラー
```bash
# 型チェック
pnpm typecheck
```

### Stripe関連

#### Webhookが受信されない
1. `pnpm stripe:listen` が実行中か確認
2. `STRIPE_WEBHOOK_SECRET` が正しく設定されているか確認
3. ポート番号（3000）が正しいか確認

#### 決済が失敗する
1. Stripeダッシュボードでテストモードになっているか確認
2. Price IDが正しいか確認
3. `pnpm stripe:check` を実行

#### データベースに反映されない
1. Webhookが正常に受信されているか確認
2. サーバーログでエラーを確認
3. マイグレーションが実行されているか確認（`pnpm db:push`）

### データベース関連

#### 接続エラー
1. `TURSO_DATABASE_URL` と `TURSO_AUTH_TOKEN` が正しいか確認
2. Tursoデータベースが存在するか確認（`turso db list`）
3. 認証トークンが有効か確認

#### マイグレーションエラー
```bash
# スキーマを直接プッシュ（開発環境）
pnpm db:push

# マイグレーションをリセット（注意: データが失われます）
turso db shell template-turso-mono "DROP TABLE IF EXISTS ..."
pnpm db:push
```

## デプロイ

### Vercel（推奨）

1. GitHubリポジトリをVercelに接続
2. 環境変数を設定:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`（Stripeダッシュボードで本番用エンドポイントを作成）
   - `NEXT_PUBLIC_STRIPE_PRICE_ID_*`
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL`（本番URL）
3. デプロイ

### Stripe Webhookの設定（本番環境）

1. Stripeダッシュボード > 開発者 > Webhook
2. 「エンドポイントを追加」
3. URL: `https://your-domain.com/api/stripe/webhook`
4. イベントを選択:
   - `product.created`, `product.updated`
   - `price.created`, `price.updated`
   - `checkout.session.completed`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `payment_intent.succeeded`
5. Webhook Secretを環境変数に設定

## 参考リンク

### 公式ドキュメント
- [Turborepo](https://turbo.build/repo)
- [Next.js](https://nextjs.org/)
- [Turso](https://turso.tech/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Better Auth](https://www.better-auth.com/)
- [Stripe](https://stripe.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)

### コミュニティ
- [Turborepo Discord](https://turbo.build/discord)
- [Next.js Discord](https://nextjs.org/discord)
- [Turso Discord](https://discord.gg/turso)

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します！

1. このリポジトリをフォーク
2. フィーチャーブランチを作成（`git checkout -b feature/amazing-feature`）
3. 変更をコミット（`git commit -m 'feat: add amazing feature'`）
4. ブランチにプッシュ（`git push origin feature/amazing-feature`）
5. プルリクエストを作成

