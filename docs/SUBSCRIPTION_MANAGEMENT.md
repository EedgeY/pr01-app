# サブスクリプション管理機能

このドキュメントでは、月額・年額サブスクリプションの管理機能の実装について説明します。

## 実装した機能

### 1. ダッシュボードでのサブスクリプション表示改善

**場所**: `apps/web/app/dashboard/page.tsx`

- **日本語化**: サブスクリプションのステータス（有効、キャンセル済み、トライアル中）を日本語で表示
- **期間表示**: 月額は「月」、年額は「年」と日本語で表示
- **プラン変更ボタン**: アクティブなサブスクリプションに対してプラン変更ボタンを表示

### 2. プラン変更機能

#### 2.1 クライアントコンポーネント

**場所**: `apps/web/app/dashboard/_components/change-plan-button.tsx`

- 現在のプラン以外のサブスクリプションプランを表示するダイアログ
- プラン変更の実行
- エラーハンドリング

#### 2.2 APIエンドポイント

**場所**: `apps/web/app/api/stripe/change-subscription/route.ts`

- ユーザー認証チェック
- アクティブなサブスクリプションの確認
- 新しいプライスの検証
- Stripeでのサブスクリプション変更処理
- 日割り計算の適用

#### 2.3 Stripe関数の追加

**場所**: `packages/stripe/src/webhook.ts`

新しく追加された関数:

```typescript
// サブスクリプションのプランを変更
changeSubscriptionPlan(subscriptionId, newPriceId, proration)

// 顧客のアクティブなサブスクリプションを取得
getActiveSubscriptions(customerId)
```

### 3. Webhookでの重複サブスクリプション管理

**場所**: `apps/web/app/api/stripe/webhook/route.ts`

`handleSubscriptionUpsert` 関数を改善:

- 新しいサブスクリプションが `active` の場合、同じユーザーの他のアクティブなサブスクリプションをチェック
- 古いサブスクリプションを自動的にキャンセル状態に更新
- 1ユーザー1サブスクリプションを保証

### 4. 料金ページでの現在のプラン強調表示

#### 4.1 現在のサブスクリプション取得API

**場所**: `apps/web/app/api/subscription/current/route.ts`

- ユーザーの現在アクティブなサブスクリプション情報を取得
- 認証されていないユーザーには `null` を返す

#### 4.2 料金ページの更新

**場所**: `apps/web/app/pricing/page.tsx`

- ページ読み込み時に現在のサブスクリプション情報を取得
- 現在のプランを視覚的に強調表示（ボーダー強調、「現在のプラン」バッジ）
- 現在のプランのボタンを無効化し「利用中」と表示

## データフロー

### プラン変更のフロー

```
1. ユーザーがダッシュボードで「プラン変更」ボタンをクリック
2. ChangePlanButtonコンポーネントがダイアログを表示
3. ユーザーが新しいプランを選択
4. /api/stripe/change-subscription にPOSTリクエスト
5. バックエンドで検証と変更処理
6. Stripeのサブスクリプションを更新（日割り計算付き）
7. データベースを即座に更新
8. Stripe Webhookが customer.subscription.updated イベントを送信
9. Webhookハンドラーがデータベースを最終更新
10. ページがリフレッシュされ、新しいプランが表示される
```

### 重複サブスクリプション防止のフロー

```
1. Stripe Webhookが customer.subscription.created または customer.subscription.updated を受信
2. handleSubscriptionUpsert が呼ばれる
3. 新しいサブスクリプションがactiveかチェック
4. 同じユーザーの他のactiveなサブスクリプションを検索
5. 見つかった場合、古いサブスクリプションをcanceledに更新
6. 新しいサブスクリプション情報をデータベースに保存
```

## データベーススキーマ

### subscriptions テーブル

関連するフィールド:

```typescript
{
  id: string;              // Stripe Subscription ID
  userId: string;          // ユーザーID
  status: string;          // active, canceled, incomplete, etc.
  priceId: string;         // Stripe Price ID (月額/年額を区別)
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  // ... その他のフィールド
}
```

### prices テーブル

関連するフィールド:

```typescript
{
  id: string;              // Stripe Price ID
  productId: string;       // Stripe Product ID
  type: 'one_time' | 'recurring';
  interval: 'month' | 'year' | 'week' | 'day' | null;
  unitAmount: number;      // 金額（セント単位）
  // ... その他のフィールド
}
```

## 環境変数

必要な環境変数（既存のStripe設定を使用）:

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs（料金ページで使用）
NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_ID_ONETIME=price_...
```

## 使用方法

### 1. ユーザーがプランを変更する

1. ダッシュボードにアクセス
2. サブスクリプションセクションで「プラン変更」ボタンをクリック
3. 希望するプラン（月額または年額）を選択
4. 変更が適用され、日割り計算で請求される

### 2. 料金ページで現在のプランを確認

1. 料金ページ（`/pricing`）にアクセス
2. 現在のサブスクリプションプランが強調表示される
3. 「利用中」と表示され、ボタンが無効化される

## テスト

### 手動テスト手順

1. **新規サブスクリプション作成**
   - 料金ページから月額プランを購入
   - ダッシュボードで月額プランが表示されることを確認

2. **プラン変更**
   - ダッシュボードで「プラン変更」をクリック
   - 年額プランを選択
   - 変更が反映されることを確認

3. **料金ページでの表示**
   - 料金ページにアクセス
   - 現在のプランが強調表示されることを確認

4. **Webhook処理**
   - Stripe CLIでWebhookをテスト
   - 複数のサブスクリプションイベントを送信
   - 古いサブスクリプションが正しくキャンセルされることを確認

### Stripe CLIでのテスト

```bash
# Webhookイベントをシミュレート
stripe trigger customer.subscription.updated

# サブスクリプション作成
stripe trigger customer.subscription.created
```

## 注意事項

1. **日割り計算**: プラン変更時は自動的に日割り計算が適用されます
2. **Webhook遅延**: Stripe WebhookとAPIの両方でデータベースを更新するため、一時的な不整合が発生する可能性がありますが、最終的には同期されます
3. **1ユーザー1サブスクリプション**: システムは1ユーザーが複数のアクティブなサブスクリプションを持つことを防ぎますが、Stripe側で手動操作を行う場合は注意が必要です

## トラブルシューティング

### プラン変更ができない

- アクティブなサブスクリプションが存在するか確認
- 新しいプライスIDが正しいか確認
- ブラウザのコンソールでエラーメッセージを確認

### 古いサブスクリプションがキャンセルされない

- Webhookが正しく設定されているか確認
- サーバーログで Webhook イベントを確認
- データベースのサブスクリプションテーブルを確認

### 料金ページで現在のプランが表示されない

- `/api/subscription/current` が正常に動作しているか確認
- ユーザーがログインしているか確認
- ブラウザのネットワークタブでAPIレスポンスを確認

### Webhookで400エラーが発生する

**症状**: Stripe CLIまたはダッシュボードで `customer.subscription.created` や `customer.subscription.updated` イベントが400エラーになる

**原因と解決策**:

1. **ユーザーが見つからない**:
   - エラーログ: `❌ User not found for customer: cus_xxx`
   - 確認事項: Stripeの顧客IDがデータベースの `user.stripeCustomerId` に保存されているか
   - 解決策: チェックアウト完了時に顧客IDを保存するようにする

2. **サブスクリプションにアイテムがない**:
   - エラーログ: `❌ Subscription sub_xxx has no items`
   - 原因: 無効なサブスクリプションデータ
   - 解決策: Stripeダッシュボードでサブスクリプションデータを確認

3. **型エラー**:
   - すでに修正済み: Stripe APIの型とデータベーススキーマの型の不一致を解消
   - ステータス値のバリデーションを実装済み

**デバッグ方法**:

```bash
# Stripe CLIでログを確認
stripe listen --forward-to localhost:3000/api/stripe/webhook

# サーバーログを確認（Next.jsの場合）
# ターミナルに詳細なログが出力されます
```

ログの例:
```
💾 Saving subscription sub_xxx for customer cus_xxx
   Status: active
   User found: user@example.com (user_id)
   Price ID: price_xxx
✅ Subscription saved successfully: sub_xxx
```

