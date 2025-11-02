'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@workspace/auth/client';
import { Button } from '@workspace/ui/components/button';
import { useState } from 'react';

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push('/');
            router.refresh();
          },
        },
      });
    } catch (error) {
      console.error('サインアウトに失敗しました:', error);
      setLoading(false);
    }
  };

  return (
    <Button variant='ghost' onClick={handleSignOut} disabled={loading}>
      {loading ? 'サインアウト中...' : 'サインアウト'}
    </Button>
  );
}
