import 'server-only';

export { openai, withRetry } from './clients/openrouter';
export {
  detectFormFields,
  validateFields,
  groupFieldsByPage,
  sortFieldsByReadingOrder,
} from './agents';

export type {
  DetectedField,
  FieldDetectionResult,
} from './agents/formFieldAgent';

// OCR exports
export * from './ocr';

// Note: クライアントコンポーネントでは '@workspace/ai/src/clients/models' から直接インポートしてください
// export { availableModels, defaultModel } from './clients/models';
export type { ModelId } from './clients/models';
