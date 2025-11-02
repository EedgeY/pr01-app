import { stripe } from './client';
import type Stripe from 'stripe';

export interface CreatePortalSessionParams {
  customerId: string;
  returnUrl: string;
}

/**
 * 顧客ポータルセッションを作成
 * @param params - ポータルセッション作成パラメータ
 * @returns Stripe Billing Portal Session
 */
export async function createPortalSession(
  params: CreatePortalSessionParams
): Promise<Stripe.BillingPortal.Session> {
  const { customerId, returnUrl } = params;

  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
