import { stripe } from './client';
import type Stripe from 'stripe';

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn(
    'STRIPE_WEBHOOK_SECRET is not set - webhook verification will fail'
  );
}

/**
 * Webhookイベントを検証
 * @param payload - リクエストボディ（raw）
 * @param signature - Stripe-Signatureヘッダー
 * @returns 検証済みのStripeイベント
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }

  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

/**
 * Stripe顧客を作成
 * @param email - 顧客のメールアドレス
 * @param name - 顧客の名前（オプション）
 * @param metadata - メタデータ（オプション）
 * @returns Stripe Customer
 */
export async function createCustomer(
  email: string,
  name?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  return await stripe.customers.create({
    email,
    name,
    metadata,
  });
}

/**
 * Stripe顧客を取得
 * @param customerId - 顧客ID
 * @returns Stripe Customer
 */
export async function getCustomer(
  customerId: string
): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
  return await stripe.customers.retrieve(customerId);
}

/**
 * サブスクリプションを取得
 * @param subscriptionId - サブスクリプションID
 * @returns Stripe Subscription
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * サブスクリプションをキャンセル
 * @param subscriptionId - サブスクリプションID
 * @param cancelAtPeriodEnd - 期間終了時にキャンセルするか
 * @returns Stripe Subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  if (cancelAtPeriodEnd) {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return await stripe.subscriptions.cancel(subscriptionId);
  }
}

/**
 * サブスクリプションのプランを変更
 * @param subscriptionId - サブスクリプションID
 * @param newPriceId - 新しい価格ID
 * @param proration - 日割り計算を行うか（デフォルト: true）
 * @returns Stripe Subscription
 */
export async function changeSubscriptionPlan(
  subscriptionId: string,
  newPriceId: string,
  proration: boolean = true
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  if (!subscription.items.data[0]) {
    throw new Error('Subscription has no items');
  }

  return await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: proration ? 'create_prorations' : 'none',
  });
}

/**
 * 顧客のアクティブなサブスクリプションを取得
 * @param customerId - 顧客ID
 * @returns アクティブなStripe Subscriptions
 */
export async function getActiveSubscriptions(
  customerId: string
): Promise<Stripe.Subscription[]> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
  });

  return subscriptions.data;
}
