# OCR Viewer & Service

このプロジェクトは、OCR（光学文字認識）機能を備えたWebアプリケーションとOCRサービスを提供するモノレポです。Turborepoを使用して、Next.jsベースのWebアプリケーションとPythonベースのOCRサービスを管理しています。

## プロジェクト構成

- **apps/web**: Next.jsアプリケーション - OCRビューアー（PDFアップロード、OCR処理、結果表示）
- **apps/ocr-service**: Python FastAPIサービス - yomitokuを使用したOCR処理
- **packages/**: 共有パッケージ（AI機能、UIコンポーネント、設定など）

## 必要条件

- Node.js 18+
- Python 3.11+
- pnpm

## インストール

```bash
# 依存関係のインストール
pnpm install
```

## 環境設定

### Webアプリケーションの設定

`apps/web/.env.local`ファイルを作成し、必要な環境変数を設定してください：

```bash
# 例: apps/web/.env.example をコピーして設定
cp apps/web/.env.example apps/web/.env.local
```

# OpenRouterのAPIキーが必要です

# プロジェクトはOpenRouterを利用しています。下記を.env.localに追加してください

OPENROUTER_API_KEY=your_openrouter_api_key

### OCRサービスの設定

`apps/ocr-service/`ディレクトリ内の設定を確認してください。

## 実行方法

### 開発環境

```bash
# 全サービスの起動
pnpm dev
```

### 個別サービス起動

```bash
# Webアプリケーションのみ
pnpm dev --filter=web

# OCRサービスのみ
pnpm dev --filter=ocr-service
```

## 使用方法

### Webアプリケーション

1. ブラウザで http://localhost:3000 にアクセス
2. OCRビューアーページ（`/ocr-viewer`）に移動
3. PDFファイルをアップロード
4. OCR処理を実行
5. 結果を確認・編集

### APIエンドポイント

- **OCR処理**: `POST /api/ocr`
- **フィールド検出**: `POST /api/ocr/detect-fields`
- **セグメント生成**: `POST /api/ocr/generate-segments`

## アーキテクチャ

- **Frontend**: Next.js + React + TypeScript
- **Backend**: Python FastAPI + yomitoku
- **Build Tool**: Turborepo + Turbopack
- **Package Manager**: pnpm
- **OCR Engine**: yomitoku (Python)
