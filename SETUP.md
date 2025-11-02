# セットアップガイド

このドキュメントでは、Template Turso Monoの詳細なセットアップ手順を説明します。

## 前提条件

- Node.js 20以上
- pnpm 10以上
- Turso CLI
- Stripeアカウント
- （オプション）Google/GitHubアカウント（OAuth用）

## ステップバイステップガイド

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone <repository-url>
cd template-turso-mono
pnpm install
```

### 2. Tursoデータベースのセットアップ

#### Turso CLIのインストール

```bash
# macOS/Linux
curl -sSfL https://get.tur.so/install.sh | bash

# Windows (PowerShell)
irm get.tur.so/install.ps1 | iex
```

#### データベースの作成

```bash
# Tursoにログイン
turso auth login

# データベース作成
turso db create template-turso-mono

# データベース情報の確認
turso db show template-turso-mono
# → URL: libsql://[database-name]-[org].turso.io

# 認証トークンの作成
turso db tokens create template-turso-mono
# → トークンをコピー
```

### 3. Stripeのセットアップ

#### Stripeアカウントの準備

1. [Stripe Dashboard](https://dashboard.stripe.com/)にアクセス
2. テストモードに切り替え
3. APIキーを取得:
   - **Developers** → **API keys**
   - **Secret key** と **Publishable key** をコピー

#### 製品と価格の作成

1. **Products** → **Add product**
2. 以下の3つの製品を作成:

**月額プラン:**
- Name: Monthly Subscription
- Price: ¥1,000/月
- Recurring: Monthly
- 価格IDをコピー（例: `price_xxxxxxxxxxxxx`）

**年額プラン:**
- Name: Yearly Subscription
- Price: ¥10,000/年
- Recurring: Yearly
- 価格IDをコピー

**都度課金:**
- Name: One-time Purchase
- Price: ¥5,000
- One-time
- 価格IDをコピー

#### Webhookの設定

1. **Developers** → **Webhooks** → **Add endpoint**
2. Endpoint URL: `https://your-domain.com/api/stripe/webhook`
   - ローカル開発時は [Stripe CLI](https://stripe.com/docs/stripe-cli) を使用
3. 以下のイベントを選択:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `payment_intent.succeeded`
   - `product.created`
   - `product.updated`
   - `price.created`
   - `price.updated`
4. Webhook signing secretをコピー（`whsec_xxxxx`）

#### ローカル開発でのWebhookテスト

```bash
# Stripe CLIのインストール
brew install stripe/stripe-cli/stripe

# Stripeにログイン
stripe login

# Webhookをローカルにフォワード
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 別のターミナルでテストイベントを送信
stripe trigger checkout.session.completed
```

### 4. OAuth設定（オプション）

> 📚 **詳細なガイド**: [docs/OAUTH_SETUP.md](./docs/OAUTH_SETUP.md) でより詳しい設定手順とトラブルシューティングを確認できます。

#### Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成
3. **APIs & Services** → **Credentials**
4. **Create Credentials** → **OAuth client ID**
5. Application type: **Web application**
6. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-domain.com/api/auth/callback/google`
7. Client IDとClient Secretをコピー

#### GitHub OAuth

1. [GitHub Settings](https://github.com/settings/developers)にアクセス
2. **OAuth Apps** → **New OAuth App**
3. Application name: `Template Turso Mono`
4. Homepage URL: `http://localhost:3000`
5. Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
6. Client IDとClient Secretをコピー

### 5. 環境変数の設定

#### apps/web/.env.local

```bash
# Turso
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# Better Auth
AUTH_SECRET=your-32-character-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# OAuth (Optional)
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id
OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret
OAUTH_GITHUB_CLIENT_ID=your-github-client-id
OAUTH_GITHUB_CLIENT_SECRET=your-github-client-secret

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY=price_monthly
NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY=price_yearly
NEXT_PUBLIC_STRIPE_PRICE_ID_ONETIME=price_onetime
```

#### AUTH_SECRETの生成

```bash
openssl rand -base64 32
```

### 6. データベースマイグレーション

```bash
# マイグレーションファイルの生成
pnpm db:generate

# マイグレーションの実行
pnpm db:migrate

# または開発時は直接プッシュ
pnpm db:push
```

### 7. 開発サーバーの起動

```bash
pnpm dev
```

アプリケーションは `http://localhost:3000` で起動します。

### 8. 動作確認

1. トップページ（`/`）にアクセス
2. サインアップ（`/sign-up`）で新規ユーザーを作成
3. ダッシュボード（`/dashboard`）にリダイレクトされることを確認
4. 料金ページ（`/pricing`）で決済をテスト
5. Stripe Checkoutにリダイレクトされることを確認
6. テストカード番号: `4242 4242 4242 4242`
7. 決済完了後、ダッシュボードでサブスクリプション/支払いが表示されることを確認

## トラブルシューティング

### データベース接続エラー

```
Error: TURSO_DATABASE_URL is not set
```

→ `.env.local` ファイルが正しく配置されているか確認してください。

### Stripe Webhookエラー

```
Error: No signature provided
```

→ Stripe CLIで `stripe listen` を実行しているか確認してください。

### 認証エラー

```
Error: AUTH_SECRET is not set
```

→ `AUTH_SECRET` が32文字以上であることを確認してください。

## 次のステップ

- [README.md](./README.md) で使用方法を確認
- 各パッケージのREADMEで詳細を確認:
  - [packages/db/README.md](./packages/db/README.md)
  - [packages/auth/README.md](./packages/auth/README.md)
  - [packages/stripe/README.md](./packages/stripe/README.md)
- カスタマイズして独自の機能を追加

