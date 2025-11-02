# クイックスタートガイド

このガイドでは、Stripe決済機能を含むアプリケーションを最速でセットアップする手順を説明します。

## 前提条件

- Node.js 20以上
- pnpm 10以上
- Stripeアカウント（テストモード）
- Tursoアカウント

## セットアップ手順（10分）

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. Tursoデータベースの作成

```bash
# Turso CLIのインストール（初回のみ）
curl -sSfL https://get.tur.so/install.sh | bash

# ログイン
turso auth login

# データベース作成
turso db create template-turso-mono

# データベースURL取得
turso db show template-turso-mono --url

# 認証トークン作成
turso db tokens create template-turso-mono
```

### 3. Stripeの設定

#### 3.1 Stripe CLIのインストール

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**その他のOS:**
[Stripe CLI インストールガイド](https://stripe.com/docs/stripe-cli#install)

#### 3.2 Stripeにログイン

```bash
stripe login
```

#### 3.3 テスト用プロダクトの作成

1. [Stripe Dashboard](https://dashboard.stripe.com/) にアクセス
2. 左上のトグルで「テストモード」に切り替え
3. 「商品カタログ」→「商品」→「商品を追加」

**月額プラン:**
- 商品名: Demo Monthly Plan
- 金額: 1000 JPY
- 請求期間: 月次
- Price IDをコピー（`price_xxxxx`）

**年額プラン:**
- 商品名: Demo Yearly Plan
- 金額: 10000 JPY
- 請求期間: 年次
- Price IDをコピー

**都度課金:**
- 商品名: Demo One-time Purchase
- 金額: 5000 JPY
- 請求期間: 1回限り
- Price IDをコピー

#### 3.4 APIキーの取得

1. 「開発者」→「APIキー」
2. シークレットキー（`sk_test_xxxxx`）をコピー

### 4. 環境変数の設定

`apps/web/.env.local` を作成：

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx  # 後で設定
NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY=price_xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY=price_xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PRICE_ID_ONETIME=price_xxxxxxxxxxxxxxxxxxxxx

# Turso
TURSO_DATABASE_URL=libsql://your-database-name.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# Better Auth
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=http://localhost:3000
```

### 5. データベースマイグレーション

```bash
pnpm db:push
```

### 6. 設定チェック

```bash
pnpm stripe:check
```

エラーがある場合は、メッセージに従って修正してください。

### 7. 開発サーバーの起動

**ターミナル1（Webhook転送）:**
```bash
pnpm stripe:listen
```

出力された `whsec_xxxxx` を `apps/web/.env.local` の `STRIPE_WEBHOOK_SECRET` に設定してください。

**ターミナル2（開発サーバー）:**
```bash
pnpm dev
```

### 8. アプリケーションにアクセス

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## テストフロー

### 1. ユーザー登録

1. 「サインアップ」をクリック
2. 以下を入力：
   - 名前: Test User
   - メール: test@example.com
   - パスワード: password123
3. 「サインアップ」

### 2. サブスクリプション購入

1. 「料金プラン」をクリック
2. 「月額プラン」の「サブスクリプションを開始」をクリック
3. テストカード情報を入力：
   - カード番号: `4242 4242 4242 4242`
   - 有効期限: `12/34`
   - CVC: `123`
   - 郵便番号: `123-4567`
4. 「申し込む」をクリック

### 3. ダッシュボードで確認

1. `/dashboard` にリダイレクトされる
2. サブスクリプション情報が表示される
3. ステータスが「active」になっている

### 4. サブスクリプション管理

1. 「サブスクリプション管理」をクリック
2. Stripe Billing Portalが開く
3. サブスクリプションの解約やプラン変更が可能

## よくある問題

### Webhookが受信されない

**原因**: Stripe CLIが起動していない、またはポート番号が違う

**解決方法**:
```bash
# ターミナル1で実行
pnpm stripe:listen
```

### 決済が失敗する

**原因**: Price IDが間違っている、またはテストモードになっていない

**解決方法**:
1. Stripeダッシュボードでテストモードになっているか確認
2. Price IDが正しいか確認
3. `pnpm stripe:check` を実行して設定を確認

### データベースに反映されない

**原因**: マイグレーションが実行されていない

**解決方法**:
```bash
pnpm db:push
```

## 次のステップ

- [STRIPE_TEST_GUIDE.md](./STRIPE_TEST_GUIDE.md) - 詳細なテスト手順
- [STRIPE_SETUP.md](./STRIPE_SETUP.md) - Stripe設定の詳細
- [README.md](./README.md) - プロジェクト全体のドキュメント

## 便利なコマンド

```bash
# 設定チェック
pnpm stripe:check

# Webhook転送
pnpm stripe:listen

# 開発サーバー起動
pnpm dev

# データベースGUI
pnpm db:studio

# ビルド
pnpm build

# リント
pnpm lint
```

## サポート

問題が発生した場合は、以下を確認してください：

1. `pnpm stripe:check` の出力
2. ブラウザのコンソール（F12）
3. サーバーログ（ターミナル）
4. Stripe CLIの出力

詳細なドキュメント：
- [Stripe Documentation](https://stripe.com/docs)
- [Turso Documentation](https://docs.turso.tech/)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

