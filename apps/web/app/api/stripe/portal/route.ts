import { NextRequest, NextResponse } from "next/server";
import { auth } from "@workspace/auth";
import { db } from "@workspace/db/client";
import { user } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { createPortalSession } from "@workspace/stripe/portal";
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

    // ユーザー情報取得
    const [userData] = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!userData || !userData.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 404 }
      );
    }

    // ポータルセッション作成
    const portalSession = await createPortalSession({
      customerId: userData.stripeCustomerId,
      returnUrl: `${request.nextUrl.origin}/dashboard`,
    });

    // 303リダイレクト（POST→GETに変換してリダイレクト）
    return NextResponse.redirect(portalSession.url, 303);
  } catch (error) {
    console.error("Error creating portal session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

