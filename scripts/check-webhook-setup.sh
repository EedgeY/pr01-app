#!/bin/bash

# Stripe Webhook設定確認スクリプト
# このスクリプトは、Stripe Webhookが正しく設定されているかを確認します

set -e

echo "🔍 Stripe Webhook設定チェック"
echo "================================"
echo ""

# カラーコード
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# チェック結果
ALL_OK=true

# 1. Stripe CLIのインストール確認
echo "1️⃣  Stripe CLIのインストール確認..."
if command -v stripe &> /dev/null; then
    echo -e "${GREEN}✅ Stripe CLI がインストールされています${NC}"
    STRIPE_VERSION=$(stripe --version)
    echo "   バージョン: $STRIPE_VERSION"
else
    echo -e "${RED}❌ Stripe CLI がインストールされていません${NC}"
    echo "   インストール方法: brew install stripe/stripe-cli/stripe"
    ALL_OK=false
fi
echo ""

# 2. Stripe CLIのログイン確認
echo "2️⃣  Stripe CLIのログイン確認..."
if stripe config --list &> /dev/null; then
    echo -e "${GREEN}✅ Stripe CLI にログイン済みです${NC}"
else
    echo -e "${RED}❌ Stripe CLI にログインしていません${NC}"
    echo "   ログイン方法: stripe login"
    ALL_OK=false
fi
echo ""

# 3. 環境変数の確認
echo "3️⃣  環境変数の確認..."

ENV_FILE="apps/web/.env.local"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ $ENV_FILE が見つかりません${NC}"
    echo "   作成方法: apps/web/.env.example を参考に .env.local を作成してください"
    ALL_OK=false
else
    echo -e "${GREEN}✅ $ENV_FILE が存在します${NC}"
    
    # STRIPE_SECRET_KEYの確認
    if grep -q "^STRIPE_SECRET_KEY=" "$ENV_FILE"; then
        if grep "^STRIPE_SECRET_KEY=sk_test_" "$ENV_FILE" &> /dev/null; then
            echo -e "${GREEN}✅ STRIPE_SECRET_KEY が設定されています (テストモード)${NC}"
        elif grep "^STRIPE_SECRET_KEY=sk_live_" "$ENV_FILE" &> /dev/null; then
            echo -e "${YELLOW}⚠️  STRIPE_SECRET_KEY が本番モードです${NC}"
        else
            echo -e "${RED}❌ STRIPE_SECRET_KEY の形式が不正です${NC}"
            ALL_OK=false
        fi
    else
        echo -e "${RED}❌ STRIPE_SECRET_KEY が設定されていません${NC}"
        ALL_OK=false
    fi
    
    # STRIPE_WEBHOOK_SECRETの確認
    if grep -q "^STRIPE_WEBHOOK_SECRET=" "$ENV_FILE"; then
        if grep "^STRIPE_WEBHOOK_SECRET=whsec_" "$ENV_FILE" &> /dev/null; then
            echo -e "${GREEN}✅ STRIPE_WEBHOOK_SECRET が設定されています${NC}"
        else
            echo -e "${RED}❌ STRIPE_WEBHOOK_SECRET の形式が不正です (whsec_ で始まる必要があります)${NC}"
            ALL_OK=false
        fi
    else
        echo -e "${RED}❌ STRIPE_WEBHOOK_SECRET が設定されていません${NC}"
        echo "   取得方法: stripe listen --forward-to http://localhost:3000/api/stripe/webhook"
        ALL_OK=false
    fi
fi
echo ""

# 4. stripe listen プロセスの確認
echo "4️⃣  Stripe listen プロセスの確認..."
if pgrep -f "stripe listen" > /dev/null; then
    echo -e "${GREEN}✅ stripe listen が実行中です${NC}"
    LISTEN_PID=$(pgrep -f "stripe listen")
    echo "   プロセスID: $LISTEN_PID"
else
    echo -e "${YELLOW}⚠️  stripe listen が実行されていません${NC}"
    echo "   起動方法: stripe listen --forward-to http://localhost:3000/api/stripe/webhook"
    echo "   ※ 開発中は別のターミナルウィンドウで常に実行してください"
fi
echo ""

# 5. データベーステーブルの確認
echo "5️⃣  データベーステーブルの確認..."
DB_FILE="packages/db/local.db"

if [ ! -f "$DB_FILE" ]; then
    echo -e "${RED}❌ データベースファイルが見つかりません${NC}"
    echo "   作成方法: cd packages/db && pnpm drizzle-kit push"
    ALL_OK=false
else
    echo -e "${GREEN}✅ データベースファイルが存在します${NC}"
    
    # テーブルの存在確認
    TABLES=$(sqlite3 "$DB_FILE" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    
    if echo "$TABLES" | grep -q "subscriptions"; then
        echo -e "${GREEN}✅ subscriptions テーブルが存在します${NC}"
    else
        echo -e "${RED}❌ subscriptions テーブルが見つかりません${NC}"
        echo "   作成方法: cd packages/db && pnpm drizzle-kit push"
        ALL_OK=false
    fi
    
    if echo "$TABLES" | grep -q "payments"; then
        echo -e "${GREEN}✅ payments テーブルが存在します${NC}"
    else
        echo -e "${RED}❌ payments テーブルが見つかりません${NC}"
        echo "   作成方法: cd packages/db && pnpm drizzle-kit push"
        ALL_OK=false
    fi
fi
echo ""

# 最終結果
echo "================================"
if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}✅ すべてのチェックが完了しました！${NC}"
    echo ""
    echo "次のステップ:"
    echo "1. 開発サーバーを起動: turbo run dev"
    echo "2. Stripe listen を起動: stripe listen --forward-to http://localhost:3000/api/stripe/webhook"
    echo "3. ブラウザで決済をテスト: http://localhost:3000/pricing"
else
    echo -e "${RED}⚠️  一部のチェックが失敗しました${NC}"
    echo ""
    echo "詳細な設定手順は以下を参照してください:"
    echo "- STRIPE_SETUP.md"
    echo "- docs/STRIPE_WEBHOOK_SETUP.md"
fi
echo ""


