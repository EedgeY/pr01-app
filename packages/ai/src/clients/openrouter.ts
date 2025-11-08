import 'server-only';
import OpenAI from 'openai';

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is not set');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_URL ?? 'http://localhost:3000',
    'X-Title': 'Writing Workflow',
  },
});

export const defaultModel = 'openai/gpt-4o-mini';

// レート制限対応のリトライヘルパー
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // 429 (レート制限) または 5xx (サーバーエラー) の場合のみリトライ
      const shouldRetry =
        error?.status === 429 ||
        (error?.status >= 500 && error?.status < 600);

      if (!shouldRetry || attempt === maxRetries) {
        throw error;
      }

      // 指数バックオフ
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

