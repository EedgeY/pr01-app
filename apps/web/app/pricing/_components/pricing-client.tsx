'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@workspace/ui/components/button';
import Link from 'next/link';
import { getCookie } from '@/lib/client-cookies';

interface PricingPlan {
  priceId: string;
  name: string;
  description: string;
  price: number;
  mode: 'subscription' | 'payment';
  interval?: string | null;
  features: string[];
  currency: string;
}

interface PricingClientProps {
  plans: PricingPlan[];
}

export function PricingClient({ plans }: PricingClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [currentPriceId, setCurrentPriceId] = useState<string | null>(null);

  // 現在のサブスクリプション情報を取得
  useEffect(() => {
    async function fetchCurrentSubscription() {
      try {
        const response = await fetch('/api/subscription/current');
        if (response.ok) {
          const data = await response.json();
          if (data.subscription?.priceId) {
            setCurrentPriceId(data.subscription.priceId);
          }
        }
      } catch (err) {
        console.error('Failed to fetch current subscription:', err);
      }
    }

    fetchCurrentSubscription();
  }, []);

  const handleCheckout = async (plan: PricingPlan) => {
    setError('');
    setLoading(plan.priceId);

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCookie('csrf_token') ?? '',
        },
        body: JSON.stringify({
          priceId: plan.priceId,
          mode: plan.mode,
        }),
      });

      // 未認証の場合はサインインページへリダイレクト
      if (response.status === 401) {
        router.push('/sign-in?callbackUrl=/pricing');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'チェックアウトの作成に失敗しました'
      );
      setLoading(null);
    }
  };

  if (plans.length === 0) {
    return (
      <div className='min-h-screen bg-background flex items-center justify-center'>
        <div className='text-center'>
          <h2 className='text-2xl font-bold mb-4'>プランが見つかりません</h2>
          <p className='text-muted-foreground mb-6'>
            現在利用可能な料金プランがありません。
            <br />
            管理者にお問い合わせください。
          </p>
          <Link href='/'>
            <Button>ホームに戻る</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background'>
      <header className='border-b'>
        <div className='container mx-auto px-4 py-4 flex justify-between items-center'>
          <Link href='/'>
            <h1 className='text-2xl font-bold'>料金プラン</h1>
          </Link>
          <div className='flex gap-4'>
            <Link href='/dashboard'>
              <Button variant='outline'>ダッシュボード</Button>
            </Link>
            <Link href='/sign-in'>
              <Button variant='ghost'>サインイン</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className='container mx-auto px-4 py-16'>
        <div className='text-center mb-12'>
          <h2 className='text-4xl font-bold mb-4'>
            あなたに最適なプランを選択
          </h2>
          <p className='text-xl text-muted-foreground'>
            サブスクリプションまたは都度課金からお選びいただけます
          </p>
        </div>

        {error && (
          <div className='max-w-2xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600'>
            {error}
          </div>
        )}

        <div
          className={`grid gap-8 max-w-6xl mx-auto ${
            plans.length === 1
              ? 'md:grid-cols-1 max-w-md'
              : plans.length === 2
                ? 'md:grid-cols-2 max-w-4xl'
                : 'md:grid-cols-3'
          }`}
        >
          {plans.map((plan) => {
            const isCurrentPlan = currentPriceId === plan.priceId;
            return (
              <div
                key={plan.priceId}
                className={`bg-card rounded-lg border p-8 flex flex-col relative ${
                  isCurrentPlan ? 'border-primary border-2 shadow-lg' : ''
                }`}
              >
                {isCurrentPlan && (
                  <div className='absolute -top-3 left-1/2 transform -translate-x-1/2'>
                    <span className='bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-medium'>
                      現在のプラン
                    </span>
                  </div>
                )}
                <div className='mb-6'>
                  <h3 className='text-2xl font-bold mb-2'>{plan.name}</h3>
                  <p className='text-sm text-muted-foreground mb-4'>
                    {plan.description}
                  </p>
                  <div className='flex items-baseline'>
                    <span className='text-4xl font-bold'>
                      {plan.currency === 'jpy'
                        ? '¥'
                        : plan.currency.toUpperCase()}
                      {plan.price.toLocaleString()}
                    </span>
                    {plan.interval && (
                      <span className='text-muted-foreground ml-2'>
                        /{' '}
                        {plan.interval === 'month'
                          ? '月'
                          : plan.interval === 'year'
                            ? '年'
                            : plan.interval}
                      </span>
                    )}
                  </div>
                </div>

                <ul className='space-y-3 mb-8 grow'>
                  {plan.features.map((feature, index) => (
                    <li key={index} className='flex items-start'>
                      <svg
                        className='w-5 h-5 text-green-500 mr-2 mt-0.5 shrink-0'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M5 13l4 4L19 7'
                        />
                      </svg>
                      <span className='text-sm'>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleCheckout(plan)}
                  disabled={loading !== null || isCurrentPlan}
                  className='w-full'
                >
                  {isCurrentPlan
                    ? '利用中'
                    : loading === plan.priceId
                      ? '処理中...'
                      : plan.mode === 'subscription'
                        ? 'サブスクリプションを開始'
                        : '今すぐ購入'}
                </Button>
              </div>
            );
          })}
        </div>

        <div className='mt-16 text-center text-sm text-muted-foreground'>
          <p>
            すべてのプランは安全なStripe決済を使用しています。
            <br />
            サブスクリプションはいつでもキャンセル可能です。
          </p>
        </div>
      </main>
    </div>
  );
}
