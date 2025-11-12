/**
 * Available LLM models configuration
 * This file can be imported in both client and server components
 */

export const availableModels = [
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: '2.5 Pro',
  },
  {
    id: 'google/gemini-2.5-flash-preview-09-2025',
    name: 'Gemini 2.5 Flash Preview',
    description: '2.5 Flash',
  },
  {
    id: 'google/gemini-2.5-flash-lite-preview-09-2025',
    name: 'Gemini 2.5 Flash Lite Preview',
    description: 'Lite',
  },
  {
    id: 'x-ai/grok-4-fast',
    name: 'Grok 4 Fast',
    description: 'Grok',
  },
  {
    id: 'qwen/qwen3-vl-235b-a22b-thinking',
    name: 'Qwen3 VL Thinking',
    description: 'Qwen3',
  },
  {
    id: 'mistralai/mistral-medium-3',
    name: 'Mistral Medium 3',
    description: 'Mistral',
  },
] as const;

export type ModelId = (typeof availableModels)[number]['id'];

export const defaultModel: ModelId = 'google/gemini-2.5-pro';
