import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { auth } from '@workspace/auth';
import { db } from '@workspace/db/client';
import {
  user,
  subscriptions,
  payments,
  prices,
  products,
} from '@workspace/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { Button } from '@workspace/ui/components/button';
import Link from 'next/link';
import { ChangePlanButton } from './_components/change-plan-button';
import { SignOutButton } from './_components/sign-out-button';
import { AvatarUploader } from './_components/avatar-uploader';
import Image from 'next/image';

async function getSession() {
  const headersList = await headers();
  return await auth.api.getSession({ headers: headersList });
}

async function getUserData(userId: string) {
  const [userData] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return userData;
}

async function getUserSubscriptions(userId: string) {
  return await db
    .select({
      subscription: subscriptions,
      price: prices,
      product: products,
    })
    .from(subscriptions)
    .leftJoin(prices, eq(subscriptions.priceId, prices.id))
    .leftJoin(products, eq(prices.productId, products.id))
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.created));
}

// Stripeのゼロデシマル通貨（最小単位が通貨単位そのもの）
const ZERO_DECIMAL_CURRENCIES = ['jpy', 'krw', 'vnd', 'clp'];

function formatAmount(amount: number, currency: string) {
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(
    currency.toLowerCase()
  );
  const displayAmount = isZeroDecimal ? amount : amount / 100;
  return displayAmount.toLocaleString();
}

async function getUserPayments(userId: string) {
  return await db
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt))
    .limit(10);
}

async function getAvailableSubscriptionPlans() {
  return await db
    .select({
      priceId: prices.id,
      name: products.name,
      interval: prices.interval,
      amount: prices.unitAmount,
      currency: prices.currency,
    })
    .from(prices)
    .leftJoin(products, eq(prices.productId, products.id))
    .where(
      and(
        eq(prices.type, 'recurring'),
        eq(prices.active, true),
        eq(products.active, true)
      )
    );
}

export default async function DashboardPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const userData = await getUserData(session.user.id);
  const userSubscriptions = await getUserSubscriptions(session.user.id);
  const userPayments = await getUserPayments(session.user.id);
  const availablePlans = await getAvailableSubscriptionPlans();
  const cookieStore = await cookies();
  const csrfToken = cookieStore.get('csrf_token')?.value ?? '';

  return (
    <div className='min-h-screen bg-background'>
      <header className='border-b'>
        <div className='container mx-auto px-4 py-4 flex justify-between items-center'>
          <h1 className='text-2xl font-bold'>ダッシュボード</h1>
          <div className='flex gap-4 items-center'>
            <Link href='/pricing'>
              <Button variant='outline'>料金プラン</Button>
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className='container mx-auto px-4 py-8'>
        <div className='space-y-8'>
          {/* ユーザー情報 */}
          <section className='bg-card rounded-lg border p-6'>
            <h2 className='text-xl font-semibold mb-4'>アカウント情報</h2>
            <div className='space-y-2'>
              <Image
                src={userData?.image || '/images/default-user.png'}
                alt={userData?.name || 'User Image'}
                width={100}
                height={100}
              />
              <AvatarUploader />
              <p>
                <span className='font-medium'>名前:</span> {userData?.name}
              </p>
              <p>
                <span className='font-medium'>メールアドレス:</span>{' '}
                {userData?.email}
              </p>
            </div>
          </section>

          {/* サブスクリプション */}
          <section className='bg-card rounded-lg border p-6'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-xl font-semibold'>サブスクリプション</h2>
              {userData?.stripeCustomerId && (
                <form action='/api/stripe/portal' method='POST'>
                  <input type='hidden' name='_csrf' value={csrfToken} />
                  <Button variant='outline' type='submit'>
                    サブスクリプション管理
                  </Button>
                </form>
              )}
            </div>

            {userSubscriptions.length > 0 ? (
              <div className='space-y-4'>
                {userSubscriptions.map(({ subscription, price, product }) => (
                  <div
                    key={subscription.id}
                    className='border rounded-lg p-4 space-y-2'
                  >
                    <div className='flex justify-between items-start'>
                      <div>
                        <h3 className='font-semibold'>{product?.name}</h3>
                        <p className='text-sm text-muted-foreground'>
                          {price?.unitAmount && price?.currency
                            ? `¥${formatAmount(price.unitAmount, price.currency)}`
                            : ''}
                          {price?.interval &&
                            ` / ${price.interval === 'month' ? '月' : price.interval === 'year' ? '年' : price.interval}`}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          subscription.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : subscription.status === 'canceled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {subscription.status === 'active'
                          ? '有効'
                          : subscription.status === 'canceled'
                            ? 'キャンセル済み'
                            : subscription.status === 'trialing'
                              ? 'トライアル中'
                              : subscription.status}
                      </span>
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      <p>
                        期間:{' '}
                        {new Date(
                          subscription.currentPeriodStart
                        ).toLocaleDateString()}{' '}
                        -{' '}
                        {new Date(
                          subscription.currentPeriodEnd
                        ).toLocaleDateString()}
                      </p>
                      {subscription.cancelAtPeriodEnd && (
                        <p className='text-red-600'>
                          期間終了時にキャンセルされます
                        </p>
                      )}
                    </div>
                    {subscription.status === 'active' &&
                      !subscription.cancelAtPeriodEnd && (
                        <div className='pt-2'>
                          <ChangePlanButton
                            currentPriceId={subscription.priceId}
                            availablePlans={availablePlans}
                          />
                        </div>
                      )}
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-8 text-muted-foreground'>
                <p>アクティブなサブスクリプションはありません</p>
                <Link href='/pricing'>
                  <Button className='mt-4'>プランを見る</Button>
                </Link>
              </div>
            )}
          </section>

          {/* 支払い履歴 */}
          <section className='bg-card rounded-lg border p-6'>
            <h2 className='text-xl font-semibold mb-4'>支払い履歴</h2>

            {userPayments.length > 0 ? (
              <div className='space-y-2'>
                {userPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className='flex justify-between items-center border-b pb-2 last:border-b-0'
                  >
                    <div>
                      <p className='font-medium'>
                        ¥{formatAmount(payment.amount, payment.currency)}
                      </p>
                      <p className='text-sm text-muted-foreground'>
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        payment.status === 'succeeded'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {payment.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-center py-8 text-muted-foreground'>
                支払い履歴はありません
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
