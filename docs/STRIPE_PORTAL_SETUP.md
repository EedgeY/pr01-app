# Stripe Customer Portal セットアップ手順

このドキュメントでは、Stripe Customer Portal（顧客ポータル）の設定方法を説明します。

## Customer Portalとは？

Stripe Customer Portalは、顧客がセルフサービスでサブスクリプションを管理できる、Stripeが提供するホスト型UIです。

### 主な機能

- ✅ サブスクリプションのキャンセル
- ✅ プラン変更（アップグレード・ダウングレード）
- ✅ 支払い方法の更新
- ✅ 請求履歴の閲覧
- ✅ 請求書のダウンロード

## エラーが発生した場合

ダッシュボードで「サブスクリプション管理」ボタンをクリックしたときに以下のエラーが出る場合：

```
Error: No configuration provided and your test mode default configuration 
has not been created.
```

これは、Stripe Customer Portalがまだ有効化されていないことを意味します。

## セットアップ手順

### テストモード用の設定

#### 1. Stripeダッシュボードにアクセス

[Customer Portal設定ページ（テストモード）](https://dashboard.stripe.com/test/settings/billing/portal) を開きます。

または、手動でアクセス：
1. [Stripe Dashboard](https://dashboard.stripe.com/) にログイン
2. 左上のトグルで「**テストモード**」に切り替え
3. 「設定」→「請求」→「カスタマーポータル」

#### 2. カスタマーポータルを有効化

初めての場合、ページに「**Activate test link**」または「**テストリンクを有効化**」ボタンが表示されます。

このボタンをクリックすると、デフォルト設定でカスタマーポータルが有効になります。

#### 3. 機能の設定

「**機能**」タブで、顧客に許可する操作を選択します：

##### サブスクリプション管理

- **サブスクリプションのキャンセル** 
  - ✅ 有効にする（推奨）
  - オプション：
    - 即座にキャンセル
    - 期間終了時にキャンセル（推奨）
    - キャンセル理由のフィードバックを収集

- **サブスクリプションの更新**
  - ✅ 有効にする（プラン変更を許可）
  - これにより、顧客は月額⇔年額の切り替えができます

- **サブスクリプションの一時停止**
  - 必要に応じて有効化

##### 支払い

- **支払い方法の更新**
  - ✅ 有効にする（推奨）
  - 顧客がクレジットカード情報を更新できます

##### 請求書

- **請求履歴**
  - ✅ 有効にする（推奨）
  - 過去の請求書を確認・ダウンロードできます

#### 4. ビジネス情報の設定

「**ビジネス情報**」タブで、顧客に表示される情報を設定：

- **会社名**: あなたの会社名
- **サポートメールアドレス**: サポート用のメールアドレス
- **プライバシーポリシーURL**: （オプション）プライバシーポリシーのURL
- **利用規約URL**: （オプション）利用規約のURL

#### 5. カスタマイズ（オプション）

「**ブランディング**」タブで見た目をカスタマイズ：

- アクセントカラー
- ロゴ
- アイコン

#### 6. 保存

すべての設定が完了したら、「**Save changes**」または「**変更を保存**」をクリックします。

### 本番モード用の設定

本番環境にデプロイする前に、本番モードでも同じ設定を行います：

1. Stripeダッシュボードで「**本番モード**」に切り替え
2. [Customer Portal設定ページ（本番モード）](https://dashboard.stripe.com/settings/billing/portal) にアクセス
3. テストモードと同じ手順で設定

**重要**: 本番モードの設定は慎重に行ってください。実際の顧客に影響します。

## 動作確認

### テスト手順

1. アプリケーションにサインイン
2. サブスクリプションを作成（テスト用カード: `4242 4242 4242 4242`）
3. ダッシュボードページの「サブスクリプション管理」ボタンをクリック
4. Stripe Customer Portalにリダイレクトされることを確認
5. 以下の機能をテスト：
   - プラン変更
   - 支払い方法の更新
   - 請求履歴の確認
   - サブスクリプションのキャンセル

### 期待される動作

「サブスクリプション管理」ボタンをクリックすると：

1. `/api/stripe/portal` にPOSTリクエストが送信される
2. Stripeがポータルセッションを作成
3. ポータルURLにリダイレクト（例: `https://billing.stripe.com/p/session_xxx`）
4. 顧客は自分のサブスクリプション情報を確認・管理できる

## コード実装

現在のアプリケーションは既にCustomer Portalに対応しています。

### ダッシュボードのボタン

```tsx
// apps/web/app/dashboard/page.tsx
{userData?.stripeCustomerId && (
  <form action="/api/stripe/portal" method="POST">
    <Button variant="outline" type="submit">
      サブスクリプション管理
    </Button>
  </form>
)}
```

### APIエンドポイント

```typescript
// apps/web/app/api/stripe/portal/route.ts
export async function POST(request: NextRequest) {
  // セッションを確認
  const session = await auth.api.getSession({ headers: await headers() });
  
  // Stripe Customer IDを取得
  const userData = await db.select()...
  
  // ポータルセッションを作成
  const portalSession = await createPortalSession(
    userData.stripeCustomerId,
    returnUrl
  );
  
  // リダイレクト
  return NextResponse.redirect(portalSession.url);
}
```

## トラブルシューティング

### エラー: "No configuration provided"

**原因**: Customer Portalが有効化されていません。

**解決策**: 
1. [カスタマーポータル設定](https://dashboard.stripe.com/test/settings/billing/portal) にアクセス
2. 「Activate test link」をクリック
3. 設定を保存

### エラー: "Customer not found"

**原因**: ユーザーのStripe Customer IDがデータベースに保存されていません。

**解決策**:
1. チェックアウト完了時にCustomer IDが保存されているか確認
2. Webhookが正しく動作しているか確認

### ポータルセッションの作成に失敗

**原因**: APIキーが正しくない、またはネットワークエラー。

**確認事項**:
- `STRIPE_SECRET_KEY` が正しく設定されているか
- テストモード/本番モードが一致しているか

## 高度な設定

### カスタム設定の作成

デフォルト設定以外に、カスタム設定を作成できます：

```typescript
// 特定の設定を使用
const portalSession = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: returnUrl,
  configuration: 'bpc_xxx...', // カスタム設定ID
});
```

### プリフィル情報

特定のフローから始めることもできます：

```typescript
const portalSession = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: returnUrl,
  flow_data: {
    type: 'subscription_cancel',
    subscription_cancel: {
      subscription: subscriptionId,
    },
  },
});
```

## セキュリティ

### 重要な注意事項

1. **Customer IDの検証**: 常にログインユーザーのCustomer IDのみを使用
2. **リターンURLの検証**: 自サイトのURLのみを許可
3. **セッションの有効期限**: ポータルセッションは1時間で期限切れ

### 現在の実装

アプリケーションは既に以下のセキュリティ対策を実装しています：

```typescript
// 認証チェック
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// ユーザー自身のCustomer IDのみ使用
const [userData] = await db
  .select()
  .from(user)
  .where(eq(user.id, session.user.id))
  .limit(1);
```

## まとめ

- ✅ Stripe Customer Portalを有効化
- ✅ 機能を設定（キャンセル、更新、支払い方法など）
- ✅ ビジネス情報を入力
- ✅ テストモードと本番モードの両方で設定
- ✅ アプリケーションから動作確認

Customer Portalを使用することで、サブスクリプション管理のUIを自前で実装する必要がなくなり、開発時間を大幅に削減できます。

