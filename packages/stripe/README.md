# @workspace/stripe

Stripe決済機能のラッパーパッケージ。

## 機能

- Checkout Session作成（サブスクリプション・都度課金）
- 顧客ポータルセッション作成
- Webhook検証
- 顧客管理
- サブスクリプション管理

## 環境変数

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 使用方法

### Checkout Session作成

```typescript
import { createCheckoutSession } from "@workspace/stripe/checkout";

const session = await createCheckoutSession({
  customerId: "cus_xxx",
  priceId: "price_xxx",
  mode: "subscription", // または "payment"
  successUrl: "https://example.com/success",
  cancelUrl: "https://example.com/cancel",
});
```

### 顧客ポータル

```typescript
import { createPortalSession } from "@workspace/stripe/portal";

const session = await createPortalSession({
  customerId: "cus_xxx",
  returnUrl: "https://example.com/dashboard",
});
```

### Webhook検証

```typescript
import { verifyWebhookSignature } from "@workspace/stripe/webhook";

const event = verifyWebhookSignature(
  request.body,
  request.headers.get("stripe-signature")
);
```

