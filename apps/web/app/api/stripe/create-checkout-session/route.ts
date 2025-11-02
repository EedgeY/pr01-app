import { NextRequest, NextResponse } from "next/server";
import { auth } from "@workspace/auth";
import { db } from "@workspace/db/client";
import { user } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { createCheckoutSession } from "@workspace/stripe/checkout";
import { createCustomer } from "@workspace/stripe/webhook";
import { assertSameOrigin, assertCsrf } from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    // CSRF対策: 同一オリジン検証とCSRFトークン検証
    assertSameOrigin(request);
    await assertCsrf(request);

    // セッション取得
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { priceId, mode } = body;

    if (!priceId || !mode) {
      return NextResponse.json(
        { error: "priceId and mode are required" },
        { status: 400 }
      );
    }

    if (mode !== "subscription" && mode !== "payment") {
      return NextResponse.json(
        { error: "mode must be 'subscription' or 'payment'" },
        { status: 400 }
      );
    }

    // ユーザー情報取得
    const [userData] = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Stripe顧客IDがない場合は作成
    let customerId = userData.stripeCustomerId;
    if (!customerId) {
      const customer = await createCustomer(
        userData.email,
        userData.name,
        { userId: userData.id }
      );
      customerId = customer.id;

      // DBに保存
      await db
        .update(user)
        .set({ stripeCustomerId: customerId })
        .where(eq(user.id, userData.id));
    }

    // Checkout Session作成
    const checkoutSession = await createCheckoutSession({
      customerId,
      priceId,
      mode,
      successUrl: `${request.nextUrl.origin}/dashboard?success=true`,
      cancelUrl: `${request.nextUrl.origin}/pricing?canceled=true`,
      metadata: {
        userId: userData.id,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

