import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@workspace/auth';
import { db } from '@workspace/db/client';
import { user, subscriptions, prices } from '@workspace/db/schema';
import { eq, and } from 'drizzle-orm';
import { changeSubscriptionPlan } from '@workspace/stripe/webhook';
import { assertSameOrigin, assertCsrf } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    // CSRF対策: 同一オリジン検証とCSRFトークン検証
    assertSameOrigin(request);
    assertCsrf(request);

    // 認証チェック
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { newPriceId } = await request.json();

    if (!newPriceId) {
      return NextResponse.json(
        { error: 'newPriceId is required' },
        { status: 400 }
      );
    }

    // ユーザー情報を取得
    const [userData] = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!userData?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Stripe customer not found' },
        { status: 404 }
      );
    }

    // 新しいプライス情報を確認
    const [newPrice] = await db
      .select()
      .from(prices)
      .where(eq(prices.id, newPriceId))
      .limit(1);

    if (!newPrice) {
      return NextResponse.json(
        { error: 'Price not found' },
        { status: 404 }
      );
    }

    if (newPrice.type !== 'recurring') {
      return NextResponse.json(
        { error: 'Price must be recurring for subscriptions' },
        { status: 400 }
      );
    }

    // アクティブなサブスクリプションを取得
    const [activeSubscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, session.user.id),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1);

    if (!activeSubscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // 同じプランへの変更を防ぐ
    if (activeSubscription.priceId === newPriceId) {
      return NextResponse.json(
        { error: 'Already subscribed to this plan' },
        { status: 400 }
      );
    }

    // Stripeでサブスクリプションを変更
    const updatedSubscription = await changeSubscriptionPlan(
      activeSubscription.id,
      newPriceId,
      true // 日割り計算を有効化
    );

    // データベースを更新（Webhookでも更新されるが、即座に反映するため）
    await db
      .update(subscriptions)
      .set({
        priceId: newPriceId,
        currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000),
      })
      .where(eq(subscriptions.id, activeSubscription.id));

    return NextResponse.json({
      success: true,
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error('Change subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to change subscription' },
      { status: 500 }
    );
  }
}

