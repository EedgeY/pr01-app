import { db } from '@workspace/db/client';
import { prices, products } from '@workspace/db/schema';
import { eq, and } from 'drizzle-orm';
import { PricingClient } from './_components/pricing-client';

function getDefaultFeatures(interval: string | null): string[] {
  if (interval === 'month') {
    return [
      '全機能へのアクセス',
      '優先サポート',
      '月次レポート',
      'いつでもキャンセル可能',
    ];
  } else if (interval === 'year') {
    return [
      '全機能へのアクセス',
      '優先サポート',
      '月次レポート',
      '2ヶ月分無料',
      'いつでもキャンセル可能',
    ];
  } else {
    return ['特定機能へのアクセス', '永続ライセンス', '基本サポート'];
  }
}

// 通貨ごとの小数点以下の桁数（Stripeの仕様）
// 0 = 小数点なし（そのまま表示）、2 = セント単位（100で割る）
function getCurrencyDivisor(currency: string): number {
  // ゼロ小数点通貨（小数点以下がない通貨）
  const zeroDecimalCurrencies = [
    'jpy', // 日本円
    'krw', // 韓国ウォン
    'vnd', // ベトナムドン
    'clp', // チリペソ
    'pyg', // パラグアイグアラニー
    'xaf', // 中央アフリカCFAフラン
    'xof', // 西アフリカCFAフラン
    'bif', // ブルンジフラン
    'djf', // ジブチフラン
    'gnf', // ギニアフラン
    'kmf', // コモロフラン
    'mga', // マダガスカルアリアリ
    'rwf', // ルワンダフラン
    'xpf', // CFPフラン
  ];
  return zeroDecimalCurrencies.includes(currency.toLowerCase()) ? 1 : 100;
}

async function getActivePrices() {
  return await db
    .select({
      priceId: prices.id,
      productId: prices.productId,
      productName: products.name,
      productDescription: products.description,
      productImage: products.image,
      unitAmount: prices.unitAmount,
      currency: prices.currency,
      type: prices.type,
      interval: prices.interval,
      metadata: prices.metadata,
      productMetadata: products.metadata,
    })
    .from(prices)
    .innerJoin(products, eq(prices.productId, products.id))
    .where(and(eq(prices.active, true), eq(products.active, true)))
    .orderBy(prices.unitAmount);
}

export default async function PricingPage() {
  const activePrices = await getActivePrices();

  // 価格データをクライアントコンポーネント用の形式に変換
  const pricingPlans = activePrices.map((price) => {
    // metadataから機能リストを取得（JSONで保存されている想定）
    let features: string[];

    if (
      price.metadata &&
      typeof price.metadata === 'object' &&
      'features' in price.metadata
    ) {
      const featuresValue = price.metadata.features;
      if (typeof featuresValue === 'string') {
        try {
          features = JSON.parse(featuresValue);
        } catch {
          features = getDefaultFeatures(price.interval);
        }
      } else if (Array.isArray(featuresValue)) {
        features = featuresValue as string[];
      } else {
        features = getDefaultFeatures(price.interval);
      }
    } else {
      features = getDefaultFeatures(price.interval);
    }

    // 通貨に応じた除数を取得（JPYなどは1、USDなどは100）
    const divisor = getCurrencyDivisor(price.currency);

    return {
      priceId: price.priceId,
      name: price.productName || '不明なプラン',
      description: price.productDescription || '',
      price: price.unitAmount ? price.unitAmount / divisor : 0,
      mode:
        price.type === 'recurring'
          ? ('subscription' as const)
          : ('payment' as const),
      interval: price.interval,
      features,
      currency: price.currency,
    };
  });

  return <PricingClient plans={pricingPlans} />;
}
