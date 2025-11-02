'use client';

import { useState } from 'react';
import { Button } from '@workspace/ui/components/button';
import { useRouter } from 'next/navigation';
import { getCookie } from '@/lib/client-cookies';

interface ChangePlanButtonProps {
  currentPriceId: string;
  availablePlans: {
    priceId: string;
    name: string | null;
    interval: string | null;
    amount: number | null;
    currency: string;
  }[];
}

// Stripeのゼロデシマル通貨（最小単位が通貨単位そのもの）
const ZERO_DECIMAL_CURRENCIES = ['jpy', 'krw', 'vnd', 'clp'];

function formatAmount(amount: number, currency: string) {
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(currency.toLowerCase());
  const displayAmount = isZeroDecimal ? amount : amount / 100;
  return displayAmount.toLocaleString();
}

export function ChangePlanButton({
  currentPriceId,
  availablePlans,
}: ChangePlanButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [error, setError] = useState('');

  // 現在のプラン以外を表示
  const otherPlans = availablePlans.filter(
    (plan) => plan.priceId !== currentPriceId
  );

  if (otherPlans.length === 0) {
    return null;
  }

  const handleChangePlan = async (newPriceId: string) => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/stripe/change-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCookie('csrf_token') ?? '',
        },
        body: JSON.stringify({ newPriceId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change plan');
      }

      // 成功したらページをリロード
      router.refresh();
      setShowDialog(false);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : 'プランの変更に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        disabled={loading}
      >
        プラン変更
      </Button>

      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">プランを変更</h3>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3 mb-6">
              {otherPlans.map((plan) => (
                <button
                  key={plan.priceId}
                  onClick={() => handleChangePlan(plan.priceId)}
                  disabled={loading}
                  className="w-full p-4 border rounded-lg hover:border-primary transition-colors text-left disabled:opacity-50"
                >
                  <div className="font-medium">{plan.name || 'プラン'}</div>
                  <div className="text-sm text-muted-foreground">
                    {plan.amount
                      ? `¥${formatAmount(plan.amount, plan.currency)}`
                      : ''}
                    {plan.interval &&
                      ` / ${plan.interval === 'month' ? '月' : plan.interval === 'year' ? '年' : plan.interval}`}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDialog(false)}
                disabled={loading}
                className="flex-1"
              >
                キャンセル
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              ※ プラン変更時、日割り計算が適用されます
            </p>
          </div>
        </div>
      )}
    </>
  );
}

