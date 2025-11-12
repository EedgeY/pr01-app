/**
 * Available LLM models configuration
 * This file can be imported in both client and server components
 */

export const availableModels = [
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: '最高精度のモデル',
  },
  {
    id: 'google/gemini-2.5-flash-preview-09-2025',
    name: 'Gemini 2.5 Flash Preview',
    description: '高速で精度の高いモデル',
  },
  {
    id: 'google/gemini-2.5-flash-lite-preview-09-2025',
    name: 'Gemini 2.5 Flash Lite Preview',
    description: '軽量で高速なモデル',
  },
  {
    id: 'x-ai/grok-4-fast',
    name: 'Grok 4 Fast',
    description: '高速なGrokモデル',
  },
  {
    id: 'qwen/qwen3-vl-235b-a22b-thinking',
    name: 'Qwen3 VL Thinking',
    description: 'ビジョンと推論に特化したモデル',
  },
] as const;

export type ModelId = (typeof availableModels)[number]['id'];

export const defaultModel: ModelId = 'google/gemini-2.5-pro';

