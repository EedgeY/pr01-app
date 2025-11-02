# 商品・価格のセットアップ手順

このドキュメントでは、Stripeで商品と価格を作成し、アプリケーションのデータベースに自動同期する手順を説明します。

## 仕組み

このシステムでは、**Stripeダッシュボードで商品・価格を作成すると、Webhookで自動的にデータベースに同期**されます。手動でデータベースに登録する必要はありません。

### 同期フロー

```
1. Stripeダッシュボードで商品を作成
   ↓
2. Stripeが product.created イベントを送信
   ↓
3. Webhookハンドラーが受信
   ↓
4. handleProductUpsert() がデータベースに保存
   ↓
5. products テーブルに自動登録

同様に価格(Price)も自動同期されます
```

## セットアップ手順

### ステップ1: Stripe CLIでWebhookを設定

開発環境で商品・価格の同期をテストするには、Stripe CLIでWebhookを転送します：

```bash
# ターミナルで実行（開発中は実行し続ける必要があります）
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

出力された `whsec_xxx...` を `.env.local` の `STRIPE_WEBHOOK_SECRET` に設定してください。

### ステップ2: Stripeダッシュボードで商品を作成

#### 月額プラン

1. [Stripe Dashboard](https://dashboard.stripe.com/test/products) にアクセス（テストモード）
2. 「商品を追加」をクリック
3. 商品情報を入力：
   ```
   名前: 月額プラン
   説明: 毎月自動更新されるサブスクリプション
   ```
4. 価格情報を入力：
   ```
   金額: 1000
   通貨: JPY
   請求期間: 月次 (Recurring - Monthly)
   ```
5. 「商品を作成」をクリック

**重要**: 作成後、価格の **Price ID** (`price_xxxxx`) をコピーしてください。

#### 年額プラン

同様の手順で年額プランを作成：
```
名前: 年額プラン
説明: 年間契約で2ヶ月分お得
金額: 10000
通貨: JPY
請求期間: 年次 (Recurring - Yearly)
```

Price ID をコピーしてください。

#### 都度課金（オプション）

```
名前: 都度課金
説明: 一度限りの購入
金額: 5000 (または任意の金額)
通貨: JPY
請求期間: 1回限り (One time)
```

### ステップ3: Webhookで自動同期を確認

商品を作成すると、Stripe CLIを実行しているターミナルに以下のようなログが表示されます：

```bash
2025-11-01 10:30:00   --> product.created [evt_xxx...]
2025-11-01 10:30:00  <--  [200] POST http://localhost:3000/api/stripe/webhook [evt_xxx...]

2025-11-01 10:30:01   --> price.created [evt_xxx...]
2025-11-01 10:30:01  <--  [200] POST http://localhost:3000/api/stripe/webhook [evt_xxx...]
```

Next.jsのサーバーログにも以下が表示されます：

```
Received webhook event: product.created
Received webhook event: price.created
```

### ステップ4: データベースで確認

商品と価格がデータベースに保存されているか確認できます：

```bash
# データベースを開く（Turso + Drizzleの場合）
sqlite3 packages/db/local.db

# 商品を確認
SELECT * FROM products;

# 価格を確認
SELECT * FROM prices;

# SQLiteを終了
.quit
```

または、Drizzle Studioで確認：

```bash
cd packages/db
pnpm drizzle-kit studio
```

ブラウザで https://local.drizzle.studio が開き、データを確認できます。

### ステップ5: 環境変数を設定

`apps/web/.env.local` に Price ID を設定します：

```bash
# Stripe Price IDs（Stripeダッシュボードからコピー）
NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY=price_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY=price_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PRICE_ID_ONETIME=price_xxxxxxxxxxxxx  # オプション
```

これらの環境変数は料金ページ（`/pricing`）で使用されます。

## 本番環境の設定

### 本番用Webhook設定

1. [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks) にアクセス
2. 「エンドポイントを追加」をクリック
3. エンドポイントURL: `https://your-domain.com/api/stripe/webhook`
4. リッスンするイベントを選択：
   - `product.created`
   - `product.updated`
   - `price.created`
   - `price.updated`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `checkout.session.completed`
5. 「エンドポイントを追加」をクリック
6. Webhook署名シークレット（`whsec_xxx...`）をコピー
7. 本番環境の環境変数 `STRIPE_WEBHOOK_SECRET` に設定

## トラブルシューティング

### 商品が同期されない

**症状**: Stripeで商品を作成しても、データベースに反映されない

**確認事項**:
1. Stripe CLIが実行中か確認
   ```bash
   # 別ターミナルで確認
   ps aux | grep stripe
   ```
2. Next.jsの開発サーバーが起動しているか確認
3. Webhook URLが正しいか確認（`http://localhost:3000/api/stripe/webhook`）

**解決策**:
- Stripe CLIを再起動
- Next.jsサーバーを再起動（`turbo dev`）

### Webhookで400エラー

**症状**: Stripe CLIで `[400] POST ...` と表示される

**原因**:
- Webhook署名シークレットが正しく設定されていない
- データベーススキーマが更新されていない

**解決策**:
```bash
# 環境変数を確認
cat apps/web/.env.local | grep STRIPE_WEBHOOK_SECRET

# データベースマイグレーションを実行
cd packages/db
pnpm drizzle-kit push
```

### Price IDが見つからない

**症状**: Stripeダッシュボードで Price ID が見つからない

**確認方法**:
1. Stripe Dashboard → 商品カタログ → 商品
2. 作成した商品をクリック
3. 「料金設定」セクションで価格をクリック
4. URLに表示される `price_xxxxx` が Price ID です

または、Stripe CLIで確認：
```bash
stripe prices list --limit 10
```

## 手動同期（非推奨）

通常はWebhookで自動同期されますが、何らかの理由で手動で同期したい場合：

### 既存商品の同期スクリプト

```bash
# packages/db/scripts/sync-stripe-products.ts を作成
```

```typescript
import { stripe } from '@workspace/stripe/client';
import { db } from '../src/client';
import { products, prices } from '../src/schema';

async function syncProducts() {
  console.log('🔄 Syncing products from Stripe...');
  
  const stripeProducts = await stripe.products.list({ limit: 100 });
  
  for (const product of stripeProducts.data) {
    await db.insert(products).values({
      id: product.id,
      active: product.active,
      name: product.name,
      description: product.description || null,
      image: product.images?.[0] || null,
      metadata: product.metadata,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: products.id,
      set: {
        active: product.active,
        name: product.name,
        description: product.description || null,
        image: product.images?.[0] || null,
        metadata: product.metadata,
        updatedAt: new Date(),
      },
    });
    
    console.log(`✅ Synced product: ${product.name}`);
  }
  
  console.log('🔄 Syncing prices from Stripe...');
  
  const stripePrices = await stripe.prices.list({ limit: 100 });
  
  for (const price of stripePrices.data) {
    await db.insert(prices).values({
      id: price.id,
      productId: typeof price.product === 'string' ? price.product : price.product.id,
      active: price.active,
      currency: price.currency,
      type: price.type as 'one_time' | 'recurring',
      unitAmount: price.unit_amount || null,
      interval: price.recurring?.interval || null,
      intervalCount: price.recurring?.interval_count || null,
      trialPeriodDays: price.recurring?.trial_period_days || null,
      metadata: price.metadata,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: prices.id,
      set: {
        active: price.active,
        currency: price.currency,
        type: price.type as 'one_time' | 'recurring',
        unitAmount: price.unit_amount || null,
        interval: price.recurring?.interval || null,
        intervalCount: price.recurring?.interval_count || null,
        trialPeriodDays: price.recurring?.trial_period_days || null,
        metadata: price.metadata,
        updatedAt: new Date(),
      },
    });
    
    console.log(`✅ Synced price: ${price.id}`);
  }
  
  console.log('✨ Sync complete!');
}

syncProducts().catch(console.error);
```

実行：
```bash
cd packages/db
pnpm tsx scripts/sync-stripe-products.ts
```

**注意**: 通常はこの手動同期は不要です。Webhookで自動的に同期されます。

## まとめ

- ✅ Stripeダッシュボードで商品・価格を作成
- ✅ Webhookで自動的にデータベースに同期
- ✅ 手動でデータベースに登録する必要なし
- ✅ 開発環境では Stripe CLI を使用
- ✅ 本番環境では Webhook エンドポイントを設定

