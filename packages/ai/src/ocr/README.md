# OCR Module

日本語文書に特化したOCR処理とフォームフィールド検出のためのモジュール。

## 概要

このモジュールは、YomiTokuベースのOCRサービスと連携し、以下の機能を提供します：

- PDF/画像からのOCR処理
- DPI正規化による座標系の統一
- レイアウト解析（ブロック、行、トークン）
- 表構造の検出
- 日本の行政文書向けフォームフィールド検出

## アーキテクチャ

```
┌─────────────────┐
│   Next.js App   │
│  /api/ocr       │
│  /api/fields    │
└────────┬────────┘
         │
         ├─→ OCR Service (FastAPI + YomiToku)
         │   └─→ Raw OCR結果 (pixel座標)
         │
         ├─→ normalizeYomiToku.ts
         │   └─→ Normalized OCR (正規化座標)
         │
         └─→ formFieldAgent.ts (LLM)
             └─→ Detected Fields
```

## 座標系

### 正規化座標（Normalized Coordinates）

- **範囲**: [0, 1]
- **原点**: 左上 (0, 0)
- **利点**: DPI非依存、スケール変換が容易

```typescript
interface NormalizedBBox {
  x: number; // 0..1
  y: number; // 0..1
  w: number; // 0..1
  h: number; // 0..1
}
```

### ピクセル座標（Pixel Coordinates）

- **範囲**: 0..widthPx, 0..heightPx
- **原点**: 左上 (0, 0)
- **用途**: 描画、OCRサービスとのやり取り

### PDF Points

- **範囲**: PDF標準の72 DPI基準
- **用途**: PDF生成、PDF編集

## 使用例

### 1. OCR処理

```typescript
import { normalizeOcrResponse } from '@workspace/ai/src/ocr';

// Next.js API Route
const formData = new FormData();
formData.append('file', file);

const response = await fetch('http://localhost:8000/ocr', {
  method: 'POST',
  body: formData,
});

const rawOcr = await response.json();
const normalizedOcr = normalizeOcrResponse(rawOcr, 'pdf');
```

### 2. フィールド検出

```typescript
import { detectFormFields } from '@workspace/ai/src/agents/formFieldAgent';

const result = await detectFormFields(normalizedOcr);

for (const field of result.fields) {
  console.log(`${field.label}: ${field.type}`);
  console.log(`Position: (${field.bboxNormalized.x}, ${field.bboxNormalized.y})`);
}
```

### 3. 座標変換

```typescript
import { toNormalized, fromNormalized } from '@workspace/ai/src/ocr/geometry';

// Pixel → Normalized
const pixelBBox = { x: 100, y: 200, w: 300, h: 400 };
const normalized = toNormalized(pixelBBox, 2480, 3508);

// Normalized → Pixel (描画用)
const pixel = fromNormalized(normalized, canvasWidth, canvasHeight);
```

## DPI統一戦略

1. **入力時**: OCRサービスで指定DPI（デフォルト300）に統一
2. **保存**: 正規化座標 + メタデータ（widthPx, heightPx, dpi）
3. **出力時**: 必要に応じて座標変換

## テスト

```bash
cd packages/ai
pnpm test
```

## 参考

- [YomiToku GitHub](https://github.com/kotaro-kinoshita/yomitoku)
- [YomiToku Documentation](https://kotaro-kinoshita.github.io/yomitoku/)





