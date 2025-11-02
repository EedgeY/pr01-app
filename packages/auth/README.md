# @workspace/auth

Better Authを使用した認証パッケージ。

## 機能

- Email/Password認証
- OAuth認証（Google, GitHub）
- Drizzle ORMとの統合
- セッション管理

## 環境変数

```
AUTH_SECRET=your-secret-key-here
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id
OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret
OAUTH_GITHUB_CLIENT_ID=your-github-client-id
OAUTH_GITHUB_CLIENT_SECRET=your-github-client-secret
```

## 使用方法

### サーバーサイド

```typescript
import { auth } from "@workspace/auth";

// セッション取得
const session = await auth.api.getSession({ headers: request.headers });
```

### クライアントサイド

```typescript
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
```

