import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@workspace/stripe/webhook';
import { db } from '@workspace/db/client';
import {
  user,
  products,
  prices,
  subscriptions,
  payments,
} from '@workspace/db/schema';
import { eq, and } from 'drizzle-orm';
import type Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      );
    }

    // Webhook署名検証
    const event = verifyWebhookSignature(body, signature);

    console.log(`Received webhook event: ${event.type}`);

    // イベントタイプに応じて処理
    switch (event.type) {
      case 'product.created':
      case 'product.updated':
        await handleProductUpsert(event.data.object as Stripe.Product);
        break;

      case 'price.created':
      case 'price.updated':
        await handlePriceUpsert(event.data.object as Stripe.Price);
        break;

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpsert(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice
        );
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}

async function handleProductUpsert(product: Stripe.Product) {
  const productData = {
    id: product.id,
    active: product.active,
    name: product.name,
    description: product.description || null,
    image: product.images?.[0] || null,
    metadata: product.metadata,
    updatedAt: new Date(),
  };

  await db.insert(products).values(productData).onConflictDoUpdate({
    target: products.id,
    set: productData,
  });
}

async function handlePriceUpsert(price: Stripe.Price) {
  const priceData = {
    id: price.id,
    productId:
      typeof price.product === 'string' ? price.product : price.product.id,
    active: price.active,
    currency: price.currency,
    type: price.type as 'one_time' | 'recurring',
    unitAmount: price.unit_amount || null,
    interval: price.recurring?.interval || null,
    intervalCount: price.recurring?.interval_count || null,
    trialPeriodDays: price.recurring?.trial_period_days || null,
    metadata: price.metadata,
    updatedAt: new Date(),
  };

  await db.insert(prices).values(priceData).onConflictDoUpdate({
    target: prices.id,
    set: priceData,
  });
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  console.log(`✅ Checkout completed for customer: ${session.customer}`);
  console.log(`   Mode: ${session.mode}`);
  console.log(`   Payment status: ${session.payment_status}`);

  // サブスクリプションの場合
  if (session.mode === 'subscription' && session.subscription) {
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;

    // サブスクリプション情報は別のイベントで処理されるため、ここでは何もしない
    console.log(
      `   Subscription ID: ${subscriptionId} (will be saved by subscription webhook)`
    );
  }

  // 都度課金の場合
  if (session.mode === 'payment' && session.payment_intent) {
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent.id;

    console.log(
      `   PaymentIntent ID: ${paymentIntentId} (will be saved by payment webhook)`
    );
  }
}

async function handleSubscriptionUpsert(subscription: Stripe.Subscription) {
  try {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    console.log(
      `💾 Saving subscription ${subscription.id} for customer ${customerId}`
    );
    console.log(`   Status: ${subscription.status}`);

    // 顧客からユーザーIDを取得
    const [userData] = await db
      .select()
      .from(user)
      .where(eq(user.stripeCustomerId, customerId))
      .limit(1);

    if (!userData) {
      console.error(`❌ User not found for customer: ${customerId}`);
      throw new Error(`User not found for customer: ${customerId}`);
    }

    console.log(`   User found: ${userData.email} (${userData.id})`);

    if (!subscription.items.data[0]) {
      console.error(`❌ Subscription ${subscription.id} has no items`);
      throw new Error(`Subscription ${subscription.id} has no items`);
    }

    const priceId =
      typeof subscription.items.data[0].price === 'string'
        ? subscription.items.data[0].price
        : subscription.items.data[0].price.id;

    console.log(`   Price ID: ${priceId}`);

    // 新しいサブスクリプションがactiveの場合、同じユーザーの他のactiveサブスクリプションをチェック
    if (subscription.status === 'active') {
      const existingActiveSubscriptions = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userData.id),
            eq(subscriptions.status, 'active')
          )
        );

      // 新しいサブスクリプション以外のactiveなものがある場合
      // Note: この時点でDBにまだ存在しないかもしれないが、存在する場合は除外
      const otherActiveSubscriptions = existingActiveSubscriptions.filter(
        (sub) => sub.id !== subscription.id
      );

      if (otherActiveSubscriptions.length > 0) {
        console.log(
          `⚠️  Found ${otherActiveSubscriptions.length} other active subscription(s) for user ${userData.id}`
        );

        // 古いサブスクリプションをキャンセル予定に設定
        for (const oldSub of otherActiveSubscriptions) {
          console.log(`   Marking old subscription ${oldSub.id} as canceled`);
          await db
            .update(subscriptions)
            .set({
              status: 'canceled',
              canceledAt: new Date(),
              endedAt: new Date(),
            })
            .where(eq(subscriptions.id, oldSub.id));
        }
      }
    }

    // ステータスをスキーマと互換性のある値に変換
    const validStatus = [
      'active',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'past_due',
      'trialing',
      'unpaid',
    ].includes(subscription.status)
      ? (subscription.status as
          | 'active'
          | 'canceled'
          | 'incomplete'
          | 'incomplete_expired'
          | 'past_due'
          | 'trialing'
          | 'unpaid')
      : 'active'; // デフォルトはactive

    const subscriptionData = {
      id: subscription.id,
      userId: userData.id,
      status: validStatus,
      priceId,
      quantity: subscription.items.data[0].quantity || null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelAt: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000)
        : null,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      created: new Date(subscription.created * 1000),
      endedAt: subscription.ended_at
        ? new Date(subscription.ended_at * 1000)
        : null,
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : null,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      metadata: subscription.metadata,
    };

    await db.insert(subscriptions).values(subscriptionData).onConflictDoUpdate({
      target: subscriptions.id,
      set: subscriptionData,
    });

    console.log(`✅ Subscription saved successfully: ${subscription.id}`);
  } catch (error) {
    console.error(
      `❌ Error in handleSubscriptionUpsert for subscription ${subscription.id}:`,
      error
    );
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      endedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscription.id));
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // サブスクリプション請求の記録
  console.log(`Invoice payment succeeded: ${invoice.id}`);
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
) {
  const customerId =
    typeof paymentIntent.customer === 'string'
      ? paymentIntent.customer
      : paymentIntent.customer?.id;

  if (!customerId) {
    console.error('❌ No customer found for payment intent');
    return;
  }

  console.log(
    `💾 Saving payment ${paymentIntent.id} for customer ${customerId}`
  );

  // 顧客からユーザーIDを取得
  const [userData] = await db
    .select()
    .from(user)
    .where(eq(user.stripeCustomerId, customerId))
    .limit(1);

  if (!userData) {
    console.error(`❌ User not found for customer: ${customerId}`);
    return;
  }

  console.log(`   User found: ${userData.email} (${userData.id})`);

  // ステータスをスキーマと互換性のある値に変換
  const validPaymentStatus = [
    'succeeded',
    'processing',
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'canceled',
  ].includes(paymentIntent.status)
    ? (paymentIntent.status as
        | 'succeeded'
        | 'processing'
        | 'requires_payment_method'
        | 'requires_confirmation'
        | 'requires_action'
        | 'canceled')
    : 'processing'; // デフォルトはprocessing

  const paymentData = {
    id: paymentIntent.id,
    userId: userData.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: validPaymentStatus,
    metadata: paymentIntent.metadata,
    createdAt: new Date(paymentIntent.created * 1000),
  };

  await db.insert(payments).values(paymentData).onConflictDoUpdate({
    target: payments.id,
    set: paymentData,
  });

  console.log(`✅ Payment saved successfully: ${paymentIntent.id}`);
}
