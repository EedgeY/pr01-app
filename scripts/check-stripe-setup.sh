#!/bin/bash

# Stripe設定チェックスクリプト
# 開発環境の設定が正しいか確認します

set -e

echo "🔍 Stripe設定チェックを開始します..."
echo ""

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# チェック結果カウンター
ERRORS=0
WARNINGS=0

# 環境変数ファイルの存在確認
echo "📁 環境変数ファイルの確認..."
if [ -f "apps/web/.env.local" ]; then
    echo -e "${GREEN}✓${NC} apps/web/.env.local が存在します"
else
    echo -e "${RED}✗${NC} apps/web/.env.local が見つかりません"
    echo "   apps/web/.env.local.template を参考に作成してください"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 環境変数の読み込み
if [ -f "apps/web/.env.local" ]; then
    export $(cat apps/web/.env.local | grep -v '^#' | xargs)
fi

# Stripe環境変数のチェック
echo "🔑 Stripe環境変数の確認..."

# STRIPE_SECRET_KEY
if [ -n "$STRIPE_SECRET_KEY" ]; then
    if [[ $STRIPE_SECRET_KEY == sk_test_* ]]; then
        echo -e "${GREEN}✓${NC} STRIPE_SECRET_KEY が設定されています（テストモード）"
    elif [[ $STRIPE_SECRET_KEY == sk_live_* ]]; then
        echo -e "${YELLOW}⚠${NC} STRIPE_SECRET_KEY が本番モードです（開発環境ではテストモードを推奨）"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${RED}✗${NC} STRIPE_SECRET_KEY の形式が不正です"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} STRIPE_SECRET_KEY が設定されていません"
    ERRORS=$((ERRORS + 1))
fi

# STRIPE_WEBHOOK_SECRET
if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
    if [[ $STRIPE_WEBHOOK_SECRET == whsec_* ]]; then
        echo -e "${GREEN}✓${NC} STRIPE_WEBHOOK_SECRET が設定されています"
    else
        echo -e "${RED}✗${NC} STRIPE_WEBHOOK_SECRET の形式が不正です"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} STRIPE_WEBHOOK_SECRET が設定されていません"
    echo "   'stripe listen --forward-to http://localhost:3000/api/stripe/webhook' を実行してください"
    ERRORS=$((ERRORS + 1))
fi

# Price IDs
if [ -n "$NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY" ]; then
    if [[ $NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY == price_* ]]; then
        echo -e "${GREEN}✓${NC} NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY が設定されています"
    else
        echo -e "${YELLOW}⚠${NC} NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY の形式が不正です"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}✗${NC} NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY が設定されていません"
    ERRORS=$((ERRORS + 1))
fi

if [ -n "$NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY" ]; then
    if [[ $NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY == price_* ]]; then
        echo -e "${GREEN}✓${NC} NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY が設定されています"
    else
        echo -e "${YELLOW}⚠${NC} NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY の形式が不正です"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}✗${NC} NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY が設定されていません"
    ERRORS=$((ERRORS + 1))
fi

if [ -n "$NEXT_PUBLIC_STRIPE_PRICE_ID_ONETIME" ]; then
    if [[ $NEXT_PUBLIC_STRIPE_PRICE_ID_ONETIME == price_* ]]; then
        echo -e "${GREEN}✓${NC} NEXT_PUBLIC_STRIPE_PRICE_ID_ONETIME が設定されています"
    else
        echo -e "${YELLOW}⚠${NC} NEXT_PUBLIC_STRIPE_PRICE_ID_ONETIME の形式が不正です"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}✗${NC} NEXT_PUBLIC_STRIPE_PRICE_ID_ONETIME が設定されていません"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Turso環境変数のチェック
echo "💾 Turso環境変数の確認..."

if [ -n "$TURSO_DATABASE_URL" ]; then
    echo -e "${GREEN}✓${NC} TURSO_DATABASE_URL が設定されています"
else
    echo -e "${RED}✗${NC} TURSO_DATABASE_URL が設定されていません"
    ERRORS=$((ERRORS + 1))
fi

if [ -n "$TURSO_AUTH_TOKEN" ]; then
    echo -e "${GREEN}✓${NC} TURSO_AUTH_TOKEN が設定されています"
else
    echo -e "${RED}✗${NC} TURSO_AUTH_TOKEN が設定されていません"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Better Auth環境変数のチェック
echo "🔐 Better Auth環境変数の確認..."

if [ -n "$BETTER_AUTH_SECRET" ]; then
    if [ ${#BETTER_AUTH_SECRET} -ge 32 ]; then
        echo -e "${GREEN}✓${NC} BETTER_AUTH_SECRET が設定されています"
    else
        echo -e "${YELLOW}⚠${NC} BETTER_AUTH_SECRET が短すぎます（32文字以上を推奨）"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}✗${NC} BETTER_AUTH_SECRET が設定されていません"
    ERRORS=$((ERRORS + 1))
fi

if [ -n "$BETTER_AUTH_URL" ]; then
    echo -e "${GREEN}✓${NC} BETTER_AUTH_URL が設定されています"
else
    echo -e "${YELLOW}⚠${NC} BETTER_AUTH_URL が設定されていません（デフォルト値が使用されます）"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# Stripe CLIのインストール確認
echo "🛠️  Stripe CLIの確認..."
if command -v stripe &> /dev/null; then
    STRIPE_VERSION=$(stripe --version)
    echo -e "${GREEN}✓${NC} Stripe CLI がインストールされています ($STRIPE_VERSION)"
else
    echo -e "${YELLOW}⚠${NC} Stripe CLI がインストールされていません"
    echo "   インストール: brew install stripe/stripe-cli/stripe"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# 結果サマリー
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ すべてのチェックに合格しました！${NC}"
    echo ""
    echo "次のステップ:"
    echo "1. ターミナルで 'stripe listen --forward-to http://localhost:3000/api/stripe/webhook' を実行"
    echo "2. 別のターミナルで 'pnpm dev' を実行"
    echo "3. ブラウザで http://localhost:3000 にアクセス"
    echo ""
    echo "詳細なテスト手順は STRIPE_TEST_GUIDE.md を参照してください。"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS 件の警告があります${NC}"
    echo ""
    echo "警告がありますが、開発を続けることができます。"
    echo "詳細は上記のメッセージを確認してください。"
else
    echo -e "${RED}✗ $ERRORS 件のエラーがあります${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ $WARNINGS 件の警告があります${NC}"
    fi
    echo ""
    echo "エラーを修正してから再度実行してください。"
    echo "詳細な設定手順は STRIPE_SETUP.md を参照してください。"
    exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

