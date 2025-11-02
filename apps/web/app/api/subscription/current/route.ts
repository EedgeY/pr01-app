import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@workspace/auth';
import { db } from '@workspace/db/client';
import { subscriptions, prices } from '@workspace/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET() {
  try {
    // 認証チェック
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return NextResponse.json({ subscription: null });
    }

    // アクティブなサブスクリプションを取得
    const [activeSubscription] = await db
      .select({
        subscriptionId: subscriptions.id,
        priceId: subscriptions.priceId,
        status: subscriptions.status,
        interval: prices.interval,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .leftJoin(prices, eq(subscriptions.priceId, prices.id))
      .where(
        and(
          eq(subscriptions.userId, session.user.id),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1);

    return NextResponse.json({
      subscription: activeSubscription || null,
    });
  } catch (error) {
    console.error('Get current subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription' },
      { status: 500 }
    );
  }
}

