import { auth } from '@workspace/auth';
import { redirect } from 'next/navigation';

export default async function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await import('next/headers').then((mod) => mod.headers()),
  });

  if (!session?.user) {
    redirect('/sign-in');
  }

  return <>{children}</>;
}

