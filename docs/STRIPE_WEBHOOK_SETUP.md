# Stripe Webhook ローカル開発設定ガイド

このガイドでは、ローカル開発環境でStripe Webhookを受信し、決済データをデータベースに保存するための設定手順を説明します。

## 問題

Stripe決済は完了するが、データベースにサブスクリプションや支払い情報が保存されない場合、Webhookが正しく設定されていない可能性があります。

## 解決手順

### 1. Stripe CLIのインストール

まだインストールしていない場合、以下のコマンドでStripe CLIをインストールします：

```bash
# macOS (Homebrew)
brew install stripe/stripe-cli/stripe

# または公式サイトからダウンロード
# https://stripe.com/docs/stripe-cli
```

### 2. Stripeアカウントにログイン

```bash
stripe login
```

ブラウザが開くので、Stripeアカウントでログインし、CLIへのアクセスを許可します。

### 3. Webhookをローカルにフォワード

**新しいターミナルウィンドウ**を開き、以下のコマンドを実行します：

```bash
cd /Users/eedge/dev/template-turso-mono
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

実行すると、以下のような出力が表示されます：

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx (will be used until this process ends)
```

**重要**: このターミナルウィンドウは開いたままにしておいてください。閉じるとWebhookの受信が停止します。

### 4. Webhook署名シークレットを環境変数に設定

上記のコマンドで表示された`whsec_`で始まるシークレットをコピーします。

`apps/web/.env.local`ファイルを開き（なければ作成し）、以下を追加します：

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**注意**: `.env.local`は`.gitignore`に含まれており、Gitにコミットされません。

### 5. 開発サーバーを再起動

環境変数を読み込むため、開発サーバーを再起動します：

```bash
# Ctrl+C で停止してから
turbo run dev
```

### 6. 動作確認

1. ブラウザで `http://localhost:3000/pricing` にアクセス
2. プランを選択して決済を進める
3. テストカード番号 `4242 4242 4242 4242` を使用
4. 決済完了後、ターミナルに以下のようなログが表示されることを確認：

```
Received webhook event: checkout.session.completed
✅ Checkout completed for customer: cus_xxxxx
   Mode: subscription
   Payment status: paid
   Subscription ID: sub_xxxxx (will be saved by subscription webhook)

Received webhook event: customer.subscription.created
💾 Saving subscription sub_xxxxx for customer cus_xxxxx
   User found: user@example.com (user_id)
✅ Subscription saved successfully: sub_xxxxx
```

### 7. データベースの確認

決済完了後、データベースにデータが保存されていることを確認します：

```bash
# SQLiteデータベースを直接確認
cd packages/db
sqlite3 local.db "SELECT * FROM subscriptions;"
```

または、ダッシュボードページ（`/dashboard`）でサブスクリプション情報が表示されることを確認します。

## よくあるエラーと対処法

### エラー: "STRIPE_WEBHOOK_SECRET is not set"

**原因**: 環境変数が設定されていない

**対処法**:
1. `apps/web/.env.local`に`STRIPE_WEBHOOK_SECRET`を追加
2. 開発サーバーを再起動

### エラー: "No signature provided" または "Webhook signature verification failed"

**原因**: Stripe CLIが実行されていない、またはシークレットが間違っている

**対処法**:
1. `stripe listen`コマンドが実行中か確認
2. `.env.local`のシークレットが正しいか確認
3. 開発サーバーを再起動

### エラー: "User not found for customer: cus_xxxxx"

**原因**: チェックアウトセッション作成時にStripeカスタマーIDがDBに保存されていない

**対処法**:
1. 一度ログアウトして再ログイン
2. 再度決済を試す
3. それでも解決しない場合は、DBをリセット：
   ```bash
   cd packages/db
   rm local.db
   pnpm drizzle-kit push
   ```

## 本番環境での設定

本番環境では、Stripe CLIではなく、Stripeダッシュボードから直接Webhookエンドポイントを設定します：

1. [Stripe Dashboard](https://dashboard.stripe.com/) にログイン
2. **Developers** > **Webhooks** に移動
3. **Add endpoint** をクリック
4. エンドポイントURL: `https://yourdomain.com/api/stripe/webhook`
5. 以下のイベントを選択：
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `invoice.payment_succeeded`
6. Webhook署名シークレット（`whsec_`で始まる）を本番環境の環境変数に設定

## トラブルシューティング

問題が解決しない場合は、以下のログを確認してください：

1. **開発サーバーのログ** - Webhook受信とデータベース保存のログ
2. **Stripe CLIのログ** - Webhookイベントの送信ログ
3. **Stripeダッシュボード** - イベント履歴とWebhookの配信状況

詳細なデバッグ情報が必要な場合は、`apps/web/app/api/stripe/webhook/route.ts`にさらにログを追加してください。


