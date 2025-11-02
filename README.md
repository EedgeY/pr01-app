# Template Turso Mono

Turborepo + Next.js(App Router) + Turso + Drizzle + Better Auth + Stripe のモノレポテンプレート。

> 📚 **クイックスタート**: すぐに始めたい方は [QUICKSTART.md](./QUICKSTART.md) をご覧ください。

## 特徴

- 🏗️ **Turborepo**: モノレポ管理とタスクオーケストレーション
- ⚡ **Next.js 15 + Turbopack**: 高速な開発体験
- 💾 **Turso + Drizzle ORM**: エッジ対応のSQLiteデータベース
- 🔐 **Better Auth**: Email/Password + OAuth（Google/GitHub）認証
- 💳 **Stripe**: サブスクリプション + 都度課金
- 🎨 **shadcn/ui**: モダンなUIコンポーネント
- 📦 **pnpm**: 高速で効率的なパッケージ管理

## プロジェクト構成

```
template-turso-mono/
├── apps/
│   └── web/              # Next.jsアプリケーション
├── packages/
│   ├── db/               # Turso + Drizzle（スキーマ、マイグレーション）
│   ├── auth/             # Better Auth設定
│   ├── stripe/           # Stripe決済ロジック
│   ├── ui/               # 共有UIコンポーネント（shadcn/ui）
│   ├── eslint-config/    # 共有ESLint設定
│   └── typescript-config/# 共有TypeScript設定
└── turbo.json            # Turborepo設定
```

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. Tursoデータベースの作成

```bash
# Turso CLIのインストール
curl -sSfL https://get.tur.so/install.sh | bash

# データベース作成
turso db create template-turso-mono

# データベース情報取得
turso db show template-turso-mono

# 認証トークン作成
turso db tokens create template-turso-mono
```

### 3. 環境変数の設定

`.env.example` をコピーして `.env.local` を作成し、必要な値を設定します。

```bash
# ルートディレクトリ
cp .env.example .env.local

# apps/web
cp apps/web/.env.example apps/web/.env.local

# packages/db
cp packages/db/.env.example packages/db/.env.local
```

#### 必須の環境変数

**Turso:**
- `TURSO_DATABASE_URL`: Tursoデータベースのエンドポイント
- `TURSO_AUTH_TOKEN`: Turso認証トークン

**Better Auth:**
- `AUTH_SECRET`: 32文字以上のランダムな文字列（`openssl rand -base64 32`で生成）
- `NEXT_PUBLIC_APP_URL`: アプリケーションのURL（開発時は `http://localhost:3000`）

**Stripe:**
- `STRIPE_SECRET_KEY`: Stripeシークレットキー
- `STRIPE_WEBHOOK_SECRET`: Stripe Webhookシークレット
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe公開可能キー
- `NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY`: 月額プランの価格ID
- `NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY`: 年額プランの価格ID
- `NEXT_PUBLIC_STRIPE_PRICE_ID_ONETIME`: 都度課金の価格ID

**OAuth（オプション）:**
- `OAUTH_GOOGLE_CLIENT_ID` / `OAUTH_GOOGLE_CLIENT_SECRET`
- `OAUTH_GITHUB_CLIENT_ID` / `OAUTH_GITHUB_CLIENT_SECRET`

### 4. データベースマイグレーション

```bash
# マイグレーションファイル生成
pnpm db:generate

# マイグレーション実行
pnpm db:migrate

# または開発時はプッシュ
pnpm db:push
```

### 5. Stripe設定

詳細な手順は [STRIPE_SETUP.md](./STRIPE_SETUP.md) を参照してください。

**クイックスタート:**

1. [Stripe Dashboard](https://dashboard.stripe.com/)でテストモードに切り替え
2. 製品と価格を作成（月額/年額/都度課金）
3. 価格IDを環境変数に設定
4. Stripe CLIをインストール: `brew install stripe/stripe-cli/stripe`
5. ローカル開発用にWebhook転送を起動:
   ```bash
   stripe listen --forward-to http://localhost:3000/api/stripe/webhook
   ```
6. 出力されたWebhook Secretを環境変数に設定

**本番環境:**
- Webhookエンドポイントを設定: `https://your-domain.com/api/stripe/webhook`
- 以下のイベントを選択:
  - `product.created`, `product.updated`
  - `price.created`, `price.updated`
  - `checkout.session.completed`
  - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `payment_intent.succeeded`

### 6. OAuth設定（オプション）

詳細な手順は [docs/OAUTH_SETUP.md](./docs/OAUTH_SETUP.md) を参照してください。

**Google:**
1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクト作成
2. OAuth 2.0クライアントIDを作成
3. リダイレクトURIに `http://localhost:3000/api/auth/callback/google` を追加

**GitHub:**
1. [GitHub Settings](https://github.com/settings/developers)でOAuth Appを作成
2. Authorization callback URLに `http://localhost:3000/api/auth/callback/github` を設定

> 💡 **重要**: サインアップページとサインインページの両方でGoogle/GitHub認証が利用可能です。

## 開発

```bash
# 開発サーバー起動
pnpm dev

# ビルド
pnpm build

# リント
pnpm lint

# Drizzle Studio起動（データベースGUI）
pnpm db:studio
```

## スクリプト

- `pnpm dev`: 開発サーバー起動
- `pnpm build`: プロダクションビルド
- `pnpm lint`: リント実行
- `pnpm test`: テスト実行
- `pnpm db:generate`: マイグレーションファイル生成
- `pnpm db:migrate`: マイグレーション実行
- `pnpm db:push`: スキーマを直接プッシュ（開発用）
- `pnpm db:studio`: Drizzle Studio起動

## UIコンポーネントの追加

shadcn/uiコンポーネントを追加する場合:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

コンポーネントは `packages/ui/src/components` に配置されます。

## 使用方法

### 認証

```typescript
// クライアントサイド
import { useSession, signIn, signOut } from "@workspace/auth/client";

function MyComponent() {
  const { data: session } = useSession();
  
  return (
    <div>
      {session ? (
        <button onClick={() => signOut()}>Sign Out</button>
      ) : (
        <button onClick={() => signIn.email({ email, password })}>Sign In</button>
      )}
    </div>
  );
}

// サーバーサイド
import { auth } from "@workspace/auth";

const session = await auth.api.getSession({ headers: request.headers });
```

### データベース

```typescript
import { db } from "@workspace/db/client";
import { user } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

// ユーザー取得
const users = await db.select().from(user).where(eq(user.email, "test@example.com"));

// ユーザー作成
await db.insert(user).values({
  id: "user_id",
  name: "John Doe",
  email: "john@example.com",
});
```

### Stripe決済

```typescript
// Checkout Session作成
const response = await fetch("/api/stripe/create-checkout-session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    priceId: "price_xxx",
    mode: "subscription", // または "payment"
  }),
});

const { url } = await response.json();
window.location.href = url;

// 顧客ポータル
const response = await fetch("/api/stripe/portal", { method: "POST" });
const { url } = await response.json();
window.location.href = url;
```

## デプロイ

### Vercel（推奨）

1. GitHubリポジトリをVercelに接続
2. 環境変数を設定
3. デプロイ

### その他のプラットフォーム

1. `pnpm build` でビルド
2. `apps/web/.next` をデプロイ
3. 環境変数を設定

## ライセンス

MIT

## 参考リンク

- [Turborepo](https://turbo.build/repo)
- [Next.js](https://nextjs.org/)
- [Turso](https://turso.tech/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Better Auth](https://www.better-auth.com/)
- [Stripe](https://stripe.com/)
- [shadcn/ui](https://ui.shadcn.com/)
