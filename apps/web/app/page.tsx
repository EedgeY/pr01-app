import { Button } from "@workspace/ui/components/button";
import Link from "next/link";

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Template Turso Mono</h1>
          <div className="flex gap-4">
            <Link href="/pricing">
              <Button variant="outline">料金プラン</Button>
            </Link>
            <Link href="/sign-in">
              <Button>サインイン</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <section className="py-20 text-center">
          <h2 className="text-5xl font-bold mb-6">
            Turso + Drizzle + Better Auth + Stripe
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            モノレポ構成のNext.jsテンプレート。認証、データベース、決済機能を統合した拡張可能な土台です。
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg">今すぐ始める</Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline">
                料金を見る
              </Button>
            </Link>
          </div>
        </section>

        <section className="py-20 grid md:grid-cols-3 gap-8">
          <div className="bg-card rounded-lg border p-6">
            <h3 className="text-xl font-semibold mb-3">🔐 認証</h3>
            <p className="text-muted-foreground">
              Better Authによる柔軟な認証。Email/Password、OAuth（Google/GitHub）に対応。
            </p>
          </div>
          <div className="bg-card rounded-lg border p-6">
            <h3 className="text-xl font-semibold mb-3">💾 データベース</h3>
            <p className="text-muted-foreground">
              TursoとDrizzle ORMによる高速で型安全なデータベース操作。
            </p>
          </div>
          <div className="bg-card rounded-lg border p-6">
            <h3 className="text-xl font-semibold mb-3">💳 決済</h3>
            <p className="text-muted-foreground">
              Stripeによるサブスクリプションと都度課金の両方に対応。
            </p>
          </div>
        </section>

        <section className="py-20 text-center">
          <h3 className="text-3xl font-bold mb-6">拡張可能な構成</h3>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Turborepoによるモノレポ管理で、共有パッケージを活用した効率的な開発が可能です。
          </p>
          <Link href="/dashboard">
            <Button size="lg">ダッシュボードを見る</Button>
          </Link>
        </section>
      </main>

      <footer className="border-t mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>© 2025 Template Turso Mono. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
