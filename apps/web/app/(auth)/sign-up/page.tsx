'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn, signUp } from '@workspace/auth/client';
import { Button } from '@workspace/ui/components/button';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signUp.email({
        name,
        email,
        password,
        callbackURL: '/dashboard',
      });
      router.push('/dashboard');
    } catch (err) {
      setError('サインアップに失敗しました。入力内容を確認してください。');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signIn.social({
        provider: 'google',
        callbackURL: '/dashboard',
      });
    } catch (err) {
      setError('Googleサインインに失敗しました。');
      console.error(err);
      setLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signIn.social({
        provider: 'github',
        callbackURL: '/dashboard',
      });
    } catch (err) {
      setError('GitHubサインインに失敗しました。');
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center px-4'>
      <div className='w-full max-w-md space-y-8'>
        <div className='text-center'>
          <h1 className='text-3xl font-bold'>サインアップ</h1>
          <p className='mt-2 text-sm text-muted-foreground'>
            新しいアカウントを作成してください
          </p>
        </div>

        <div className='space-y-4'>
          {/* OAuth ボタン */}
          <div className='space-y-2'>
            <Button
              type='button'
              variant='outline'
              className='w-full'
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              Googleでサインアップ
            </Button>
            <Button
              type='button'
              variant='outline'
              className='w-full'
              onClick={handleGitHubSignIn}
              disabled={loading}
            >
              GitHubでサインアップ
            </Button>
          </div>

          <div className='relative'>
            <div className='absolute inset-0 flex items-center'>
              <span className='w-full border-t' />
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-background px-2 text-muted-foreground'>
                または
              </span>
            </div>
          </div>

          {/* Email/Password フォーム */}
          <form onSubmit={handleEmailSignUp} className='space-y-4'>
            <div>
              <label htmlFor='name' className='block text-sm font-medium mb-2'>
                名前
              </label>
              <input
                id='name'
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className='w-full px-3 py-2 border rounded-md'
                placeholder='山田太郎'
              />
            </div>

            <div>
              <label htmlFor='email' className='block text-sm font-medium mb-2'>
                メールアドレス
              </label>
              <input
                id='email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className='w-full px-3 py-2 border rounded-md'
                placeholder='you@example.com'
              />
            </div>

            <div>
              <label
                htmlFor='password'
                className='block text-sm font-medium mb-2'
              >
                パスワード
              </label>
              <input
                id='password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className='w-full px-3 py-2 border rounded-md'
                placeholder='••••••••'
              />
              <p className='mt-1 text-xs text-muted-foreground'>
                8文字以上で入力してください
              </p>
            </div>

            {error && (
              <div className='text-sm text-red-600 bg-red-50 p-3 rounded-md'>
                {error}
              </div>
            )}

            <Button type='submit' className='w-full' disabled={loading}>
              {loading ? '作成中...' : 'アカウントを作成'}
            </Button>
          </form>

          <p className='text-center text-sm text-muted-foreground'>
            すでにアカウントをお持ちの方は{' '}
            <Link href='/sign-in' className='font-medium underline'>
              サインイン
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
