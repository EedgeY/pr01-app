# Stripe セットアップ手順

このドキュメントでは、Stripeダッシュボードでテスト用のProduct/Priceを作成し、アプリケーションで使用するための手順を説明します。

## 1. Stripeアカウントの準備

1. [Stripe Dashboard](https://dashboard.stripe.com/) にログイン
2. 左上のトグルで「テストモード」に切り替え（テストモードであることを確認）

## 2. テスト用Productの作成

### 2.1 月額サブスクリプションプラン

1. ダッシュボードで「商品カタログ」→「商品」→「商品を追加」をクリック
2. 以下の情報を入力：
   - **商品名**: Demo Monthly Plan
   - **説明**: 月額サブスクリプションのデモプラン
   - **価格**:
     - 金額: `1000` JPY
     - 請求期間: `月次`
     - 請求モデル: `標準の価格設定`
3. 「商品を作成」をクリック
4. 作成後、価格の詳細ページで **Price ID** (`price_xxxxx` の形式) をコピーして控える

### 2.2 年額サブスクリプションプラン

1. 「商品カタログ」→「商品」→「商品を追加」をクリック
2. 以下の情報を入力：
   - **商品名**: Demo Yearly Plan
   - **説明**: 年額サブスクリプションのデモプラン（2ヶ月分お得）
   - **価格**:
     - 金額: `10000` JPY
     - 請求期間: `年次`
     - 請求モデル: `標準の価格設定`
3. 「商品を作成」をクリック
4. 作成後、価格の詳細ページで **Price ID** をコピーして控える

### 2.3 都度課金プラン

1. 「商品カタログ」→「商品」→「商品を追加」をクリック
2. 以下の情報を入力：
   - **商品名**: Demo One-time Purchase
   - **説明**: 都度課金のデモプラン
   - **価格**:
     - 金額: `5000` JPY
     - 請求期間: `1回限り`
3. 「商品を作成」をクリック
4. 作成後、価格の詳細ページで **Price ID** をコピーして控える

## 3. APIキーの取得

1. ダッシュボードで「開発者」→「APIキー」をクリック
2. **テストモード**の「シークレットキー」（`sk_test_` で始まる）を表示してコピー
3. **公開可能キー**（`pk_test_` で始まる）もコピー（今回は使用しませんが、将来的に必要になる可能性があります）

## 4. Stripe CLIのインストールと設定

### 4.1 Stripe CLIのインストール

**macOS (Homebrew):**

```bash
brew install stripe/stripe-cli/stripe
```

**その他のOS:**
[Stripe CLI インストールガイド](https://stripe.com/docs/stripe-cli#install) を参照

### 4.2 Stripe CLIでログイン

```bash
stripe login
```

ブラウザが開き、認証を求められます。認証を完了してください。

### 4.3 Webhookの転送設定

ローカル開発環境でWebhookイベントを受信するため、Stripe CLIでWebhookを転送します：

```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

このコマンドを実行すると、以下のような出力が表示されます：

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxx
```

この **webhook signing secret** (`whsec_` で始まる文字列) をコピーして控えてください。

**注意**: このコマンドは実行し続ける必要があります。開発中は別のターミナルウィンドウで実行してください。

## 5. 環境変数の設定

`apps/web/.env.local` ファイルを作成（または編集）し、以下の環境変数を設定します：

```bash
# Stripe設定
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# Stripe Price IDs（ステップ2で取得したPrice IDを設定）
NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY=price_xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY=price_xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PRICE_ID_ONETIME=price_xxxxxxxxxxxxxxxxxxxxx

# Turso Database（既存の設定）
TURSO_DATABASE_URL=libsql://your-database-url
TURSO_AUTH_TOKEN=your-auth-token

# Better Auth（既存の設定）
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000
```

## 6. テストカード情報

Stripeのテストモードでは、以下のテストカード番号を使用できます：

### 成功するカード

- **カード番号**: `4242 4242 4242 4242`
- **有効期限**: 任意の将来の日付（例: 12/34）
- **CVC**: 任意の3桁の数字（例: 123）
- **郵便番号**: 任意（例: 123-4567）

### 3Dセキュア認証が必要なカード

- **カード番号**: `4000 0027 6000 3184`

### 支払いが失敗するカード

- **カード番号**: `4000 0000 0000 9995`

詳細は [Stripe テストカード一覧](https://stripe.com/docs/testing) を参照してください。

## 7. 動作確認

1. 開発サーバーを起動:

   ```bash
   pnpm dev
   ```

2. 別のターミナルでStripe CLIのWebhook転送を起動:

   ```bash
   stripe listen --forward-to http://localhost:3000/api/stripe/webhook
   ```

3. ブラウザで `http://localhost:3000` にアクセス

4. サインアップ/サインイン後、`/pricing` ページから決済をテスト

5. 決済完了後、`/dashboard` で購入履歴やサブスクリプション状態を確認

## トラブルシューティング

### Webhookが受信されない

- Stripe CLIの `stripe listen` コマンドが実行中か確認
- `STRIPE_WEBHOOK_SECRET` が正しく設定されているか確認
- ポート番号（3000）が正しいか確認

### 決済が失敗する

- テストモードになっているか確認
- `STRIPE_SECRET_KEY` が `sk_test_` で始まるテストキーか確認
- Price IDが正しく設定されているか確認

### データベースに反映されない（決済完了後にデータが保存されない）

**⚠️ 最も一般的な問題**: Webhookが正しく設定されていない

**症状**:

- Stripe決済画面で「支払い成功」と表示される
- しかし、`/dashboard`でサブスクリプションが表示されない
- データベースに決済データが保存されていない

**解決方法**:

1. **Stripe CLIが実行中か確認**

   ```bash
   # 新しいターミナルウィンドウで実行
   stripe listen --forward-to http://localhost:3000/api/stripe/webhook
   ```

   このコマンドは開発中**常に実行し続ける**必要があります。

2. **Webhook署名シークレットを確認**
   - `stripe listen`実行時に表示される`whsec_`で始まる文字列を
   - `apps/web/.env.local`の`STRIPE_WEBHOOK_SECRET`に設定
   - 設定後、**必ず開発サーバーを再起動**

3. **ターミナルでWebhookのログを確認**
   - 決済完了後、以下のようなログが表示されるか確認：
     ```
     Received webhook event: checkout.session.completed
     Received webhook event: customer.subscription.created
     💾 Saving subscription sub_xxxxx for customer cus_xxxxx
     ✅ Subscription saved successfully: sub_xxxxx
     ```

4. **詳細な解決手順**
   - より詳しいトラブルシューティングは [`docs/STRIPE_WEBHOOK_SETUP.md`](./docs/STRIPE_WEBHOOK_SETUP.md) を参照してください

**その他の確認事項**:

- データベース接続情報（TURSO_DATABASE_URL等）が正しいか確認
- `apps/web/app/api/stripe/webhook/route.ts` のエラーログを確認
- データベースにテーブルが作成されているか確認（`pnpm --filter @workspace/db drizzle-kit push`）
