# OAuth認証設定ガイド

このドキュメントでは、Google OAuth認証とGitHub OAuth認証の設定手順を説明します。

## 機能の概要

サインアップページとサインインページの両方で、以下のOAuth認証が利用可能です：

- **Googleアカウント**でのサインアップ/サインイン
- **GitHubアカウント**でのサインアップ/サインイン

## Google OAuth設定

### 1. Google Cloud Consoleでの設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成、または既存のプロジェクトを選択
3. **APIs & Services** → **Credentials**に移動
4. **Create Credentials** → **OAuth client ID**をクリック

### 2. OAuth同意画面の設定

初めてOAuth client IDを作成する場合、OAuth同意画面の設定が必要です：

1. **User Type**を選択（開発用は**External**でOK）
2. アプリケーション名、サポートメール、デベロッパー連絡先を入力
3. **Scopes**はデフォルトのまま（email, profile, openid）でOK
4. **Test users**を追加（開発中に使用するGoogleアカウント）

### 3. OAuth認証情報の作成

1. **Application type**: **Web application**
2. **Name**: 任意の名前（例：`Template Turso Mono`）
3. **Authorized JavaScript origins**:
   - `http://localhost:3000`
   - `https://your-production-domain.com`
4. **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-production-domain.com/api/auth/callback/google`
5. **作成**をクリック
6. **Client ID**と**Client Secret**をコピー

### 4. 環境変数の設定

`apps/web/.env.local`ファイルに以下を追加：

```bash
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## GitHub OAuth設定

### 1. GitHub OAuth Appの作成

1. [GitHub Settings](https://github.com/settings/developers)にアクセス
2. **OAuth Apps** → **New OAuth App**をクリック
3. 以下の情報を入力：
   - **Application name**: `Template Turso Mono`（任意）
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. **Register application**をクリック
5. **Client ID**をコピー
6. **Generate a new client secret**をクリックして**Client Secret**をコピー

### 2. 本番環境用の設定

本番環境にデプロイする場合：

1. 新しいOAuth Appを作成するか、既存のAppを編集
2. **Homepage URL**: `https://your-production-domain.com`
3. **Authorization callback URL**: `https://your-production-domain.com/api/auth/callback/github`

### 3. 環境変数の設定

`apps/web/.env.local`ファイルに以下を追加：

```bash
OAUTH_GITHUB_CLIENT_ID=your-github-client-id
OAUTH_GITHUB_CLIENT_SECRET=your-github-client-secret
```

## 環境変数の完全な例

`apps/web/.env.local`:

```bash
# Turso Database
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# Better Auth
AUTH_SECRET=your-32-character-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# OAuth - Google
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret

# OAuth - GitHub
OAUTH_GITHUB_CLIENT_ID=your-github-client-id
OAUTH_GITHUB_CLIENT_SECRET=your-github-client-secret

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

## 動作確認

### 1. 開発サーバーの起動

```bash
pnpm dev
```

### 2. サインアップページでのテスト

1. ブラウザで`http://localhost:3000/sign-up`にアクセス
2. **Googleでサインアップ**または**GitHubでサインアップ**ボタンをクリック
3. OAuth認証フローが開始され、認証後に`/dashboard`にリダイレクトされることを確認

### 3. サインインページでのテスト

1. ブラウザで`http://localhost:3000/sign-in`にアクセス
2. **Googleでサインイン**または**GitHubでサインイン**ボタンをクリック
3. 認証後に`/dashboard`にリダイレクトされることを確認

## トラブルシューティング

### エラー: `redirect_uri_mismatch`

**原因**: Google Cloud ConsoleまたはGitHubで設定したリダイレクトURIが一致していません。

**解決方法**:
- Google: `http://localhost:3000/api/auth/callback/google`が**Authorized redirect URIs**に登録されているか確認
- GitHub: `http://localhost:3000/api/auth/callback/github`が**Authorization callback URL**に設定されているか確認

### エラー: OAuthボタンをクリックしても何も起こらない

**原因**: 環境変数が正しく設定されていません。

**解決方法**:
1. `.env.local`ファイルが`apps/web/`ディレクトリに存在するか確認
2. 環境変数名が正確に一致しているか確認（スペースや余分な文字がないか）
3. 開発サーバーを再起動（`.env.local`の変更後は再起動が必要）

### エラー: `AUTH_SECRET is not set`

**原因**: `AUTH_SECRET`が設定されていないか、32文字未満です。

**解決方法**:
```bash
# ランダムな32文字のキーを生成
openssl rand -base64 32

# 生成されたキーを.env.localのAUTH_SECRETに設定
```

### Google OAuth同意画面が表示されない

**原因**: OAuthアプリがテストモードで、テストユーザーが追加されていません。

**解決方法**:
1. Google Cloud Console → **OAuth consent screen**
2. **Test users**にテスト用のGoogleアカウントを追加
3. 追加したアカウントでサインインを試す

## セキュリティのベストプラクティス

1. **本番環境では必ず`NEXT_PUBLIC_APP_URL`を正しいドメインに設定**
2. **`.env.local`はGitにコミットしない**（`.gitignore`で除外済み）
3. **Client Secretは絶対に公開しない**
4. **本番環境とローカル環境で異なるOAuth Appを使用**することを推奨
5. **定期的にClient Secretをローテーション**

## 参考リンク

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Apps Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)

