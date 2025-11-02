import type Stripe from 'stripe';
import { stripe } from './client';

export interface CreateCheckoutSessionParams {
  customerId: string;
  priceId: string;
  mode: 'subscription' | 'payment';
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

/**
 * Checkout Sessionを作成
 * @param params - セッション作成パラメータ
 * @returns Stripe Checkout Session
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<Stripe.Checkout.Session> {
  const { customerId, priceId, mode, successUrl, cancelUrl, metadata } = params;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  };

  // サブスクリプションの場合は自動課金を有効化
  if (mode === 'subscription') {
    sessionParams.subscription_data = {
      metadata,
    };
  }

  return await stripe.checkout.sessions.create(sessionParams);
}

/**
 * Checkout Sessionを取得
 * @param sessionId - セッションID
 * @returns Stripe Checkout Session
 */
export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items', 'customer'],
  });
}
