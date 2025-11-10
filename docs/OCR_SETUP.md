# OCR統合セットアップガイド

YomiTokuベースのOCR機能の統合ガイド。

## 概要

このシステムは以下のコンポーネントで構成されています：

1. **OCRサービス** (`apps/ocr-service`): FastAPI + YomiToku
   - `/ocr`: 統合処理（Document Analyzer）
   - `/ocr/ocr-only`: 文字位置抽出（OCRモジュール）
   - `/ocr/layout`: レイアウト構造抽出（LayoutAnalyzer）
2. **OCR正規化** (`packages/ai/src/ocr`): 座標系の統一
3. **Next.js API** (`apps/web/app/api/ocr/*`): エンドポイント
4. **ビューア** (`apps/web/app/ocr-viewer`): 動作確認UI

## セットアップ手順

### 1. OCRサービスのセットアップ

#### 依存関係のインストール

```bash
cd apps/ocr-service
pip install -r requirements.txt
```

#### Poppler（PDF処理用）のインストール

**macOS:**
```bash
brew install poppler
```

**Ubuntu/Debian:**
```bash
sudo apt-get install poppler-utils
```

**Windows:**
[poppler releases](https://github.com/oschwartz10612/poppler-windows/releases)からダウンロード

#### GPU/MPS対応（オプション）

**CUDA (NVIDIA GPU):**
```bash
pip install torch --index-url https://download.pytorch.org/whl/cu124
```

**MPS (Apple Silicon):**
PyTorch 2.5以降は自動的にMPSをサポートします。

デバイス優先順位: CUDA > MPS > CPU

#### OCRサービスの起動

```bash
cd apps/ocr-service
python main.py
```

サービスは `http://localhost:8000` で起動します。

ヘルスチェック:
```bash
curl http://localhost:8000/health
```

### 2. 環境変数の設定

`apps/web/.env.local` に以下を追加：

```bash
# OCRサービスのURL（デフォルト: http://localhost:8000）
OCR_SERVICE_URL=http://localhost:8000
```

**注意**: `OCR_SERVICE_URL`が設定されていない場合、デフォルトで`http://localhost:8000`が使用されます。

### 3. Next.jsアプリの起動

```bash
# ルートディレクトリから
pnpm dev
```

または特定のアプリのみ：

```bash
turbo dev --filter=web
```

### 4. 動作確認

ブラウザで `http://localhost:3000/ocr-viewer` にアクセス。

1. モードを選択:
   - **文字位置（OCR）**: 文字の位置と読み取り結果のみ
   - **レイアウト構造**: 段落・テーブル・図表の構造のみ
   - **統合（Document）**: 文字+構造の完全な解析
2. PDF/画像ファイルをアップロード
3. "アップロード & 実行" をクリック
4. OCR結果が自動的に可視化される
5. Blocks/Tables/Figuresのトグルで表示を切り替え

## API使用例

### 統合OCR API (`/api/ocr`)

完全な文書解析（文字+レイアウト構造）:

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('dpi', '300');
formData.append('device', 'cuda'); // 'cuda' | 'mps' | 'cpu'
formData.append('lite', 'false'); // 軽量モデルを使う場合はtrue

const response = await fetch('/api/ocr', {
  method: 'POST',
  body: formData,
});

const ocr: NormalizedOcr = await response.json();
```

### OCR専用API (`/api/ocr/ocr-only`)

文字位置の抽出のみ（高速）:

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('dpi', '300');

const response = await fetch('/api/ocr/ocr-only', {
  method: 'POST',
  body: formData,
});

const ocr: NormalizedOcr = await response.json();
// ocr.pages[].blocks に文字ブロック情報
```

### レイアウト専用API (`/api/ocr/layout-only`)

レイアウト構造の抽出のみ:

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('dpi', '300');

const response = await fetch('/api/ocr/layout-only', {
  method: 'POST',
  body: formData,
});

const ocr: NormalizedOcr = await response.json();
// ocr.pages[].tables, .figures にレイアウト情報
```

## 座標系の理解

### 正規化座標（推奨）

すべてのbboxは正規化座標 [0,1] で保存されます：

```typescript
interface NormalizedBBox {
  x: number; // 0..1 (左からの相対位置)
  y: number; // 0..1 (上からの相対位置)
  w: number; // 0..1 (幅の相対値)
  h: number; // 0..1 (高さの相対値)
}
```

### 座標変換

```typescript
import { fromNormalized } from '@workspace/ai/src/ocr/geometry';

// Canvas描画用にピクセル座標へ変換
const pixelBBox = fromNormalized(
  field.bboxNormalized,
  canvasWidth,
  canvasHeight
);

ctx.strokeRect(pixelBBox.x, pixelBBox.y, pixelBBox.w, pixelBBox.h);
```

## DPI統一戦略

1. **入力**: OCRサービスで300 DPIに統一
2. **保存**: 正規化座標 + メタデータ（widthPx, heightPx, dpi）
3. **出力**: 必要に応じて変換

これにより、異なるDPIの画像間で座標のズレが発生しません。

## パフォーマンス最適化

### 軽量モデルの使用

処理速度を優先する場合：

```typescript
formData.append('lite', 'true');
```

注意: 軽量モデルは1行あたり最大50文字の制限があります。

### デバイス選択

処理に使用するデバイスを指定:

```typescript
formData.append('device', 'cuda'); // NVIDIA GPU
formData.append('device', 'mps');  // Apple Silicon
formData.append('device', 'cpu');  // CPU
```

指定したデバイスが利用できない場合、自動的にフォールバックします。

### ページ分割

大きなPDFは自動的にページごとに処理されます。

## トラブルシューティング

### OCRサービスに接続できない

```bash
# ヘルスチェック
curl http://localhost:8000/health

# ログ確認
cd apps/ocr-service
python main.py
```

### YomiTokuのインストールエラー

```bash
# 最新版を再インストール
pip uninstall yomitoku
pip install yomitoku>=0.10.1
```

### GPU/CUDAエラー

```bash
# CPU実行に切り替え
formData.append('device', 'cpu');
```

### メモリ不足

- 軽量モデルを使用
- 画像サイズを縮小（DPIを下げる）
- ページを分割して処理

## テスト

```bash
# 幾何ユーティリティのテスト
cd packages/ai
pnpm test

# E2Eテスト（TODO）
# テストフィクスチャを用意してから実行
```

## Docker実行（オプション）

```bash
cd apps/ocr-service
docker build -t ocr-service .
docker run -p 8000:8000 ocr-service
```

## 本番環境デプロイ

### OCRサービス

- GPU対応インスタンス（推奨: NVIDIA T4以上）
- 最低8GB VRAM
- Dockerコンテナでデプロイ

### Next.jsアプリ

環境変数 `OCR_SERVICE_URL` を本番OCRサービスのURLに設定。

```bash
OCR_SERVICE_URL=https://ocr-service.your-domain.com
```

## 参考資料

- [YomiToku GitHub](https://github.com/kotaro-kinoshita/yomitoku)
- [YomiToku Documentation](https://kotaro-kinoshita.github.io/yomitoku/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [pdf2image](https://github.com/Belval/pdf2image)

## サポート対象フォーマット

- **PDF**: 複数ページ対応
- **画像**: PNG, JPG, JPEG

## 制限事項

- 最大ファイルサイズ: 10MB（変更可能）
- YomiTokuは文書OCR向けに最適化（情景OCRには非対応）
- 最低解像度: 短辺720px以上推奨



