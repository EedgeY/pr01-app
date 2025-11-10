import 'server-only';

export { openai, defaultModel, withRetry } from './clients/openrouter';
export {
  detectFormFields,
  validateFields,
  groupFieldsByPage,
  sortFieldsByReadingOrder,
} from './agents';
export { webSearchTool, webScraperTool, vectorLookupTool } from './tools';

export type {
  DetectedField,
  FieldDetectionResult,
} from './agents/formFieldAgent';

// OCR exports
export * from './ocr';
