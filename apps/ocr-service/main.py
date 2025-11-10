"""
FastAPI OCR Service using YomiToku
Provides HTTP endpoint for document OCR with bbox extraction
"""
import asyncio
import io
import os
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from pathlib import Path
from typing import Any, Literal, Optional, Union

import numpy as np
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

# YomiToku imports
try:
    from yomitoku import DocumentAnalyzer, OCR as YTOCR, LayoutAnalyzer
except ImportError:
    raise ImportError(
        "YomiToku not installed. Install with: pip install yomitoku"
    )

# PDF処理用
try:
    from pdf2image import convert_from_bytes
except ImportError:
    convert_from_bytes = None

app = FastAPI(title="OCR Service", version="1.0.0")

# CORS設定（開発環境用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# グローバルアナライザー（起動時に初期化）
analyzer: Optional[DocumentAnalyzer] = None
lite_analyzer: Optional[DocumentAnalyzer] = None
ocr_module: Optional[YTOCR] = None
layout_analyzer: Optional[LayoutAnalyzer] = None

# スレッドプールエグゼキュータ（OCR処理用）
executor: Optional[ThreadPoolExecutor] = None


class BBox(BaseModel):
    """Bounding box in pixel coordinates (top-left origin)"""
    x: float
    y: float
    w: float
    h: float


class Token(BaseModel):
    """OCR token (character or word)"""
    text: str
    bbox: BBox
    confidence: Optional[float] = None


class Line(BaseModel):
    """Text line"""
    text: str
    bbox: BBox
    tokens: list[Token]


class Block(BaseModel):
    """Text block (paragraph, heading, etc.)"""
    text: str
    bbox: BBox
    blockType: str  # text, title, list, etc.
    lines: list[Line]


class Table(BaseModel):
    """Table structure"""
    bbox: BBox
    rows: int
    cols: int
    cells: list[dict]  # Cell structure from YomiToku


class Figure(BaseModel):
    """Figure/image region"""
    bbox: BBox
    figureType: str  # image, chart, etc.


class Page(BaseModel):
    """Single page OCR result"""
    pageIndex: int
    dpi: int
    widthPx: int
    heightPx: int
    blocks: list[Block]
    tables: Optional[list[Table]] = None
    figures: Optional[list[Figure]] = None
    readingOrder: Optional[list[int]] = None


class OCRResponse(BaseModel):
    """OCR API response"""
    pages: list[Page]
    processingTime: float
    model: str


@app.on_event("startup")
async def startup_event():
    """Initialize YomiToku models on startup"""
    global analyzer, lite_analyzer, ocr_module, layout_analyzer, executor
    
    # スレッドプールエグゼキュータを初期化
    executor = ThreadPoolExecutor(max_workers=2)
    
    # デバイス選択: CUDA > MPS > CPU
    if torch.cuda.is_available():
        device = "cuda"
    elif torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
    print(f"Initializing YomiToku on device: {device}")
    
    try:
        # 通常モデル
        analyzer = DocumentAnalyzer(
            configs={"device": device},
            visualize=False,
        )
        print("✓ Standard model loaded")
        
        # 軽量モデル
        lite_analyzer = DocumentAnalyzer(
            configs={"device": device, "lite": True},
            visualize=False,
        )
        print("✓ Lite model loaded")

        # OCRモジュール
        ocr_module = YTOCR(
            visualize=False,
            device=device,
        )
        print("✓ OCR module loaded")

        # レイアウトアナライザー
        layout_analyzer = LayoutAnalyzer(
            visualize=False,
            device=device,
        )
        print("✓ Layout analyzer loaded")
    except Exception as e:
        print(f"⚠ Warning: Could not load models: {e}")
        print("Models will be loaded on first request")


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    global executor
    if executor:
        executor.shutdown(wait=True)
        print("✓ Thread pool executor shut down")


def validate_dpi(dpi: int) -> None:
    """DPIバリデーション: 72〜600の範囲を推奨"""
    if not (72 <= dpi <= 600):
        raise HTTPException(
            status_code=400,
            detail=f"DPI must be between 72 and 600, got {dpi}"
        )


def validate_file_type(filename: str, content_type: str) -> None:
    """ファイル形式バリデーション"""
    allowed_types = {
        "application/pdf": [".pdf"],
        "image/png": [".png"],
        "image/jpeg": [".jpg", ".jpeg"],
    }
    
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Allowed: PDF, PNG, JPEG"
        )
    
    ext = Path(filename).suffix.lower()
    if ext not in allowed_types[content_type]:
        raise HTTPException(
            status_code=400,
            detail=f"File extension {ext} does not match content type {content_type}"
        )


def normalize_image_dpi(image: Image.Image, target_dpi: int) -> Image.Image:
    """
    Normalize image to target DPI if DPI info is available.
    If no DPI info, assume 72 DPI and scale accordingly.
    """
    current_dpi = image.info.get("dpi", (72, 72))
    if isinstance(current_dpi, tuple):
        current_dpi = current_dpi[0]
    
    if current_dpi != target_dpi:
        scale = target_dpi / current_dpi
        new_size = (int(image.width * scale), int(image.height * scale))
        image = image.resize(new_size, Image.Resampling.LANCZOS)
    
    return image


def process_pdf_to_images(
    pdf_bytes: bytes, dpi: int = 300
) -> list[Image.Image]:
    """Convert PDF to images at specified DPI"""
    if convert_from_bytes is None:
        raise HTTPException(
            status_code=400,
            detail="PDF support not available. Install pdf2image and poppler.",
        )
    
    images = convert_from_bytes(pdf_bytes, dpi=dpi)
    return images


def run_yomitoku_sync(analyzer_instance: DocumentAnalyzer, image_data) -> dict:
    """
    Run YomiToku in a synchronous context to avoid event loop conflicts.
    This function will be executed in a thread pool.
    
    Args:
        analyzer_instance: YomiToku DocumentAnalyzer instance
        image_data: NumPy array (H, W, C) in RGB format
    """
    result = analyzer_instance(image_data)
    
    # YomiTokuの返り値の型を確認
    print(f"YomiToku result type: {type(result)}")
    if isinstance(result, tuple):
        print(f"Tuple length: {len(result)}")
        result = result[0] if len(result) > 0 else {}
        print(f"Using first element, type: {type(result)}")
    
    # Pydanticスキーマオブジェクトの場合はdictに変換
    if hasattr(result, 'model_dump'):
        print("Converting Pydantic model using model_dump()")
        return result.model_dump()
    elif hasattr(result, 'dict'):
        print("Converting Pydantic model using dict()")
        return result.dict()
    elif isinstance(result, dict):
        return result
    else:
        print(f"Warning: Unknown result type {type(result)}, attempting to convert to dict")
        try:
            return dict(result)
        except:
            return {}

def run_module_once(module_callable, image_data):
    """
    Execute a YomiToku callable once and unwrap tuple return (results, vis) if needed.
    Also converts Pydantic models to dict for consistency.
    """
    res = module_callable(image_data)
    
    # YomiTokuは (result, visualization) のtupleを返すことがある
    if isinstance(res, tuple):
        res = res[0] if len(res) > 0 else {}
    
    # Pydanticスキーマオブジェクトの場合はdictに変換
    if hasattr(res, 'model_dump'):
        print("Converting Pydantic model using model_dump()")
        return res.model_dump()
    elif hasattr(res, 'dict'):
        print("Converting Pydantic model using dict()")
        return res.dict()
    elif isinstance(res, dict):
        return res
    else:
        print(f"Warning: Unknown result type {type(res)}, attempting to convert to dict")
        try:
            return dict(res)
        except:
            return {}


def yomitoku_result_to_page(
    result: Union[dict, Any], page_index: int, dpi: int, width: int, height: int
) -> Page:
    """
    Convert YomiToku result to our Page schema.
    YomiToku returns paragraphs, tables, figures, and words with bboxes in pixel coordinates.
    """
    # YomiTokuがtupleを返す場合の処理
    print(f"yomitoku_result_to_page received type: {type(result)}")
    if isinstance(result, tuple):
        print(f"Result is tuple with length: {len(result)}")
        # tupleの場合、最初の要素が結果のdictであることが多い
        if len(result) > 0:
            result = result[0]
            print(f"Using first element of tuple, type: {type(result)}")
    
    # Pydanticモデルの場合はdictに変換
    if hasattr(result, 'model_dump'):
        print("Converting Pydantic model using model_dump()")
        result = result.model_dump()
    elif hasattr(result, 'dict'):
        print("Converting Pydantic model using dict()")
        result = result.dict()
    
    blocks = []
    tables = []
    figures = []
    
    # resultの構造をログ出力
    if isinstance(result, dict):
        print(f"Result keys: {list(result.keys())}")
    
    # トップレベルのwords配列を取得（後でparagraphsと関連付け可能）
    all_words = []
    if isinstance(result, dict) and "words" in result:
        print(f"Found {len(result['words'])} words at top level")
        for word_data in result["words"]:
            # YomiToku word構造: points, content, direction, rec_score, det_score
            # pointsは [[x1, y1], [x2, y2], [x3, y3], [x4, y4]] の形式
            points = word_data.get("points", [[0, 0], [0, 0], [0, 0], [0, 0]])
            # bboxに変換（x1, y1, x2, y2）
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            x1, x2 = min(xs), max(xs)
            y1, y2 = min(ys), max(ys)
            
            all_words.append({
                "text": word_data.get("content", ""),
                "bbox": [x1, y1, x2, y2],
                "confidence": word_data.get("rec_score", 1.0),
                "direction": word_data.get("direction", "horizontal"),
            })
    
    # YomiTokuの出力構造に基づいて変換
    # paragraphsから情報を抽出
    if isinstance(result, dict) and "paragraphs" in result:
        print(f"Found {len(result['paragraphs'])} paragraphs")
        
        # 最初のparagraphの構造を確認
        if len(result['paragraphs']) > 0:
            print(f"Sample paragraph keys: {list(result['paragraphs'][0].keys())}")
            print(f"Sample paragraph: {result['paragraphs'][0]}")
        
        for idx, paragraph in enumerate(result["paragraphs"]):
            # YomiToku paragraph構造: box, contents, direction, order, role
            bbox_data = paragraph.get("box", [0, 0, 0, 0])
            bbox = BBox(
                x=float(bbox_data[0]),
                y=float(bbox_data[1]),
                w=float(bbox_data[2] - bbox_data[0]),
                h=float(bbox_data[3] - bbox_data[1]),
            )
            
            # YomiTokuスキーマでは"contents"フィールドにテキストが格納
            text_content = paragraph.get("contents", "") or ""
            
            # roleフィールドをblockTypeとして使用（例: "section_headings", "page_header", "page_footer"）
            role = paragraph.get("role") or "text"
            direction = paragraph.get("direction") or "horizontal"
            
            # blockTypeを構築
            block_type = role if role else f"paragraph_{direction}"
            
            # テキストブロックとして追加
            # 行レベルの情報（段落を1つの行として扱う）
            line = Line(
                text=text_content,
                bbox=bbox,
                tokens=[],  # wordsは後で関連付け可能
            )
            
            block = Block(
                text=text_content,
                bbox=bbox,
                blockType=block_type,
                lines=[line],
            )
            blocks.append(block)
        
        print(f"Converted {len(blocks)} paragraphs to blocks")
    
    # テーブル情報を抽出
    if isinstance(result, dict) and "tables" in result:
        print(f"Found {len(result['tables'])} tables")
        for idx, table_data in enumerate(result["tables"]):
            # YomiToku table構造: box, n_row, n_col, rows, cols, spans, cells, order
            bbox_data = table_data.get("box", [0, 0, 0, 0])
            bbox = BBox(
                x=float(bbox_data[0]),
                y=float(bbox_data[1]),
                w=float(bbox_data[2] - bbox_data[0]),
                h=float(bbox_data[3] - bbox_data[1]),
            )
            
            # YomiTokuスキーマでは n_row と n_col が整数フィールド
            rows_count = table_data.get("n_row", 0)
            cols_count = table_data.get("n_col", 0)
            
            print(f"Table {idx}: rows={rows_count}, cols={cols_count}")
            
            # cellsの構造を正しくマッピング: row, col, row_span, col_span, box, contents
            cells = []
            for cell_data in table_data.get("cells", []):
                cell_bbox_data = cell_data.get("box", [0, 0, 0, 0])
                cells.append({
                    "rowIndex": cell_data.get("row", 0),
                    "colIndex": cell_data.get("col", 0),
                    "rowSpan": cell_data.get("row_span", 1),
                    "colSpan": cell_data.get("col_span", 1),
                    "text": cell_data.get("contents", "") or "",
                    "bbox": {
                        "x": float(cell_bbox_data[0]),
                        "y": float(cell_bbox_data[1]),
                        "w": float(cell_bbox_data[2] - cell_bbox_data[0]),
                        "h": float(cell_bbox_data[3] - cell_bbox_data[1]),
                    }
                })
            
            table = Table(
                bbox=bbox,
                rows=rows_count,
                cols=cols_count,
                cells=cells,
            )
            tables.append(table)
    
    # 図表情報を抽出
    if isinstance(result, dict) and "figures" in result:
        print(f"Found {len(result['figures'])} figures")
        for figure_data in result["figures"]:
            # YomiToku figure構造: box, order, paragraphs, direction
            bbox_data = figure_data.get("box", [0, 0, 0, 0])
            bbox = BBox(
                x=float(bbox_data[0]),
                y=float(bbox_data[1]),
                w=float(bbox_data[2] - bbox_data[0]),
                h=float(bbox_data[3] - bbox_data[1]),
            )
            
            # YomiTokuスキーマにはtypeフィールドが存在しない
            # directionまたは固定値を使用
            direction = figure_data.get("direction")
            figure_type = f"figure_{direction}" if direction else "figure"
            
            figure = Figure(
                bbox=bbox,
                figureType=figure_type,
            )
            figures.append(figure)
    
    # 読み順情報
    reading_order = result.get("reading_order")
    
    return Page(
        pageIndex=page_index,
        dpi=dpi,
        widthPx=width,
        heightPx=height,
        blocks=blocks,
        tables=tables if tables else None,
        figures=figures if figures else None,
        readingOrder=reading_order,
    )

def yomitoku_ocr_to_page(
    result: Union[dict, Any], page_index: int, dpi: int, width: int, height: int
) -> Page:
    """
    Convert YomiToku OCR-only result to our Page schema.
    Treat each detected word as an individual block for precise text position extraction.
    """
    # Pydanticモデルの場合はdictに変換
    if hasattr(result, 'model_dump'):
        result = result.model_dump()
    elif hasattr(result, 'dict'):
        result = result.dict()
    
    blocks: list[Block] = []
    tables: list[Table] = []
    figures: list[Figure] = []

    # words: [{ points: [[x1,y1],...], content, rec_score, ... }]
    words = []
    if isinstance(result, dict) and "words" in result:
        words = result.get("words", [])
        print(f"Found {len(words)} words in OCR result")
    elif isinstance(result, tuple) and len(result) > 0:
        first = result[0]
        if isinstance(first, dict):
            words = first.get("words", [])

    for word in words:
        points = word.get("points", [[0, 0], [0, 0], [0, 0], [0, 0]])
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        x1, x2 = min(xs), max(xs)
        y1, y2 = min(ys), max(ys)
        bbox = BBox(
            x=float(x1),
            y=float(y1),
            w=float(x2 - x1),
            h=float(y2 - y1),
        )
        token = Token(text=word.get("content", "") or "", bbox=bbox, confidence=word.get("rec_score"))
        line = Line(text=token.text, bbox=bbox, tokens=[token])
        block = Block(text=token.text, bbox=bbox, blockType="ocr_word", lines=[line])
        blocks.append(block)

    print(f"Converted {len(blocks)} words to blocks")

    return Page(
        pageIndex=page_index,
        dpi=dpi,
        widthPx=width,
        heightPx=height,
        blocks=blocks,
        tables=None,
        figures=None,
        readingOrder=None,
    )


@app.post("/ocr", response_model=OCRResponse)
async def ocr_endpoint(
    file: UploadFile = File(...),
    dpi: int = Form(300),
    device: Literal["cpu", "cuda", "mps"] = Form("cuda"),
    lite: bool = Form(False),
):
    """
    OCR endpoint for document analysis.
    
    Args:
        file: PDF or image file (PNG, JPG, JPEG)
        dpi: Target DPI for processing (default: 300)
        device: Processing device (cpu or cuda)
        lite: Use lite model for faster processing
    
    Returns:
        OCRResponse with pages containing blocks, lines, tokens with bboxes
    """
    import time
    start_time = time.time()
    
    # バリデーション
    validate_dpi(dpi)
    validate_file_type(file.filename or "unknown", file.content_type or "")
    
    # デバイスチェック: 指定デバイスが利用不可の場合はフォールバック
    if device == "cuda" and not torch.cuda.is_available():
        device = "mps" if torch.backends.mps.is_available() else "cpu"
    elif device == "mps" and not torch.backends.mps.is_available():
        device = "cpu"
    
    # モデル選択
    global analyzer, lite_analyzer
    selected_analyzer = lite_analyzer if lite else analyzer
    
    if selected_analyzer is None:
        # 遅延初期化
        try:
            selected_analyzer = DocumentAnalyzer(
                configs={"device": device, "lite": lite},
                visualize=False,
            )
            if lite:
                lite_analyzer = selected_analyzer
            else:
                analyzer = selected_analyzer
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize YomiToku: {str(e)}",
            )
    
    # ファイル読み込み
    content = await file.read()
    file_ext = Path(file.filename or "").suffix.lower()
    
    try:
        # PDF or Image
        if file_ext == ".pdf":
            images = process_pdf_to_images(content, dpi=dpi)
        else:
            # 画像ファイル
            image = Image.open(io.BytesIO(content))
            if image.mode != "RGB":
                image = image.convert("RGB")
            image = normalize_image_dpi(image, dpi)
            images = [image]
        
        # OCR処理
        pages = []
        for page_idx, img in enumerate(images):
            try:
                # PIL ImageをNumPy配列に変換（YomiTokuが期待する形式）
                img_array = np.array(img)
                
                # YomiToku実行（スレッドプールで実行してイベントループの競合を回避）
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    executor,
                    partial(run_yomitoku_sync, selected_analyzer, img_array)
                )
                
                # 結果を変換
                page = yomitoku_result_to_page(
                    result,
                    page_index=page_idx,
                    dpi=dpi,
                    width=img.width,
                    height=img.height,
                )
                pages.append(page)
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"OCR processing failed on page {page_idx}: {str(e)}",
                )
        
        processing_time = time.time() - start_time
        
        return OCRResponse(
            pages=pages,
            processingTime=processing_time,
            model="yomitoku-lite" if lite else "yomitoku",
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(e)}",
        )

@app.post("/ocr/ocr-only", response_model=OCRResponse)
async def ocr_only_endpoint(
    file: UploadFile = File(...),
    dpi: int = Form(300),
    device: Literal["cpu", "cuda", "mps"] = Form("cuda"),
):
    """
    OCR-only endpoint.
    - 文字の位置と読み取り結果（words）にフォーカス
    - 段落・テーブル・図表の構造解析は実施しない
    """
    import time
    start_time = time.time()

    # バリデーション
    validate_dpi(dpi)
    validate_file_type(file.filename or "unknown", file.content_type or "")

    # デバイスチェック: 指定デバイスが利用不可の場合はフォールバック
    if device == "cuda" and not torch.cuda.is_available():
        device = "mps" if torch.backends.mps.is_available() else "cpu"
    elif device == "mps" and not torch.backends.mps.is_available():
        device = "cpu"

    global ocr_module
    if ocr_module is None:
        # 遅延初期化
        try:
            ocr_module = YTOCR(visualize=False, device=device)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to initialize OCR module: {str(e)}")

    content = await file.read()
    file_ext = Path(file.filename or "").suffix.lower()

    try:
        if file_ext == ".pdf":
            images = process_pdf_to_images(content, dpi=dpi)
        else:
            image = Image.open(io.BytesIO(content))
            if image.mode != "RGB":
                image = image.convert("RGB")
            image = normalize_image_dpi(image, dpi)
            images = [image]

        pages: list[Page] = []
        for page_idx, img in enumerate(images):
            img_array = np.array(img)
            loop = asyncio.get_event_loop()
            # OCR(img) は (results, ocr_vis) を返す可能性がある
            result = await loop.run_in_executor(
                executor, partial(run_module_once, ocr_module, img_array)
            )

            page = yomitoku_ocr_to_page(
                result,
                page_index=page_idx,
                dpi=dpi,
                width=img.width,
                height=img.height,
            )
            pages.append(page)

        processing_time = time.time() - start_time
        return OCRResponse(pages=pages, processingTime=processing_time, model="yomitoku-ocr")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR-only processing failed: {str(e)}")


@app.post("/ocr/layout", response_model=OCRResponse)
async def layout_only_endpoint(
    file: UploadFile = File(...),
    dpi: int = Form(300),
    device: Literal["cpu", "cuda", "mps"] = Form("cuda"),
):
    """
    Layout-only endpoint.
    - 段落、図表、表の構造解析にフォーカス
    - テキスト認識（文字列の抽出）は実施しない
    """
    import time
    start_time = time.time()

    # バリデーション
    validate_dpi(dpi)
    validate_file_type(file.filename or "unknown", file.content_type or "")

    # デバイスチェック: 指定デバイスが利用不可の場合はフォールバック
    if device == "cuda" and not torch.cuda.is_available():
        device = "mps" if torch.backends.mps.is_available() else "cpu"
    elif device == "mps" and not torch.backends.mps.is_available():
        device = "cpu"

    global layout_analyzer
    if layout_analyzer is None:
        try:
            layout_analyzer = LayoutAnalyzer(visualize=False, device=device)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to initialize LayoutAnalyzer: {str(e)}")

    content = await file.read()
    file_ext = Path(file.filename or "").suffix.lower()

    try:
        if file_ext == ".pdf":
            images = process_pdf_to_images(content, dpi=dpi)
        else:
            image = Image.open(io.BytesIO(content))
            if image.mode != "RGB":
                image = image.convert("RGB")
            image = normalize_image_dpi(image, dpi)
            images = [image]

        pages: list[Page] = []
        for page_idx, img in enumerate(images):
            img_array = np.array(img)
            loop = asyncio.get_event_loop()
            # LayoutAnalyzer(img) は (results, layout_vis) を返す可能性がある
            layout_result = await loop.run_in_executor(
                executor,
                partial(run_module_once, layout_analyzer, img_array),
            )

            page = yomitoku_result_to_page(
                layout_result,
                page_index=page_idx,
                dpi=dpi,
                width=img.width,
                height=img.height,
            )
            pages.append(page)

        processing_time = time.time() - start_time
        return OCRResponse(pages=pages, processingTime=processing_time, model="yomitoku-layout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Layout-only processing failed: {str(e)}")


class TileSpec(BaseModel):
    """Tile specification for segmented OCR"""
    pageIndex: int
    bboxNormalized: dict  # {x, y, w, h} in [0,1]
    overlap: Optional[float] = 0.0


@app.post("/ocr/ocr-only/tiles", response_model=OCRResponse)
async def ocr_only_tiles_endpoint(
    file: UploadFile = File(...),
    tiles: str = Form(...),  # JSON string of TileSpec[]
    dpi: int = Form(300),
    device: Literal["cpu", "cuda", "mps"] = Form("cuda"),
):
    """
    OCR-only endpoint with tile-based processing.
    - タイル単位で文字認識を実行し、ページ座標に統合
    """
    import time
    import json
    start_time = time.time()

    # バリデーション
    validate_dpi(dpi)
    validate_file_type(file.filename or "unknown", file.content_type or "")

    # タイル仕様をパース
    try:
        tile_specs = json.loads(tiles)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid tiles JSON format")

    # デバイスチェック
    if device == "cuda" and not torch.cuda.is_available():
        device = "mps" if torch.backends.mps.is_available() else "cpu"
    elif device == "mps" and not torch.backends.mps.is_available():
        device = "cpu"

    global ocr_module
    if ocr_module is None:
        try:
            ocr_module = YTOCR(visualize=False, device=device)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to initialize OCR module: {str(e)}")

    content = await file.read()
    file_ext = Path(file.filename or "").suffix.lower()

    try:
        # 画像読み込み
        if file_ext == ".pdf":
            images = process_pdf_to_images(content, dpi=dpi)
        else:
            image = Image.open(io.BytesIO(content))
            if image.mode != "RGB":
                image = image.convert("RGB")
            image = normalize_image_dpi(image, dpi)
            images = [image]

        # ページごとにタイルをグループ化
        tiles_by_page = {}
        for spec in tile_specs:
            page_idx = spec["pageIndex"]
            if page_idx not in tiles_by_page:
                tiles_by_page[page_idx] = []
            tiles_by_page[page_idx].append(spec)

        # 各ページのタイルを処理
        pages: list[Page] = []
        for page_idx, img in enumerate(images):
            if page_idx not in tiles_by_page:
                # タイル指定がない場合はスキップまたは全体処理
                continue

            img_array = np.array(img)
            page_width = img.width
            page_height = img.height
            
            all_blocks: list[Block] = []
            
            # 各タイルを処理
            for tile_spec in tiles_by_page[page_idx]:
                bbox_norm = tile_spec["bboxNormalized"]
                
                # 正規化座標をピクセルに変換
                x_px = int(bbox_norm["x"] * page_width)
                y_px = int(bbox_norm["y"] * page_height)
                w_px = int(bbox_norm["w"] * page_width)
                h_px = int(bbox_norm["h"] * page_height)
                
                # タイル画像をクロップ
                tile_img = img_array[y_px:y_px+h_px, x_px:x_px+w_px]
                
                # OCR実行
                loop = asyncio.get_event_loop()
                tile_result = await loop.run_in_executor(
                    executor, partial(run_module_once, ocr_module, tile_img)
                )
                
                # タイル結果をページ座標にオフセット
                # 注: yomitoku_ocr_to_pageには実際のタイルサイズを渡す（ピクセル座標で返される）
                tile_page = yomitoku_ocr_to_page(
                    tile_result,
                    page_index=page_idx,
                    dpi=dpi,
                    width=w_px,
                    height=h_px,
                )
                
                # ブロックの座標をページ座標系に変換
                for block in tile_page.blocks:
                    # タイル内のピクセル座標をページのピクセル座標に変換
                    block.bbox.x = (block.bbox.x + x_px) / page_width
                    block.bbox.y = (block.bbox.y + y_px) / page_height
                    block.bbox.w = block.bbox.w / page_width
                    block.bbox.h = block.bbox.h / page_height
                    
                    # 行とトークンも同様に変換
                    for line in block.lines:
                        line.bbox.x = (line.bbox.x + x_px) / page_width
                        line.bbox.y = (line.bbox.y + y_px) / page_height
                        line.bbox.w = line.bbox.w / page_width
                        line.bbox.h = line.bbox.h / page_height
                        
                        for token in line.tokens:
                            token.bbox.x = (token.bbox.x + x_px) / page_width
                            token.bbox.y = (token.bbox.y + y_px) / page_height
                            token.bbox.w = token.bbox.w / page_width
                            token.bbox.h = token.bbox.h / page_height
                    
                    all_blocks.append(block)
            
            # タイル間の重複を除去（IoUベース）
            deduplicated_blocks = deduplicate_blocks_by_iou(all_blocks, iou_threshold=0.5)
            
            page = Page(
                pageIndex=page_idx,
                dpi=dpi,
                widthPx=page_width,
                heightPx=page_height,
                blocks=deduplicated_blocks,
                tables=None,
                figures=None,
                readingOrder=None,
            )
            pages.append(page)

        processing_time = time.time() - start_time
        return OCRResponse(pages=pages, processingTime=processing_time, model="yomitoku-ocr-tiles")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tile OCR processing failed: {str(e)}")


@app.post("/ocr/layout/tiles", response_model=OCRResponse)
async def layout_only_tiles_endpoint(
    file: UploadFile = File(...),
    tiles: str = Form(...),  # JSON string of TileSpec[]
    dpi: int = Form(300),
    device: Literal["cpu", "cuda", "mps"] = Form("cuda"),
):
    """
    Layout-only endpoint with tile-based processing.
    - タイル単位でレイアウト解析を実行し、ページ座標に統合
    """
    import time
    import json
    start_time = time.time()

    # バリデーション
    validate_dpi(dpi)
    validate_file_type(file.filename or "unknown", file.content_type or "")

    # タイル仕様をパース
    try:
        tile_specs = json.loads(tiles)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid tiles JSON format")

    # デバイスチェック
    if device == "cuda" and not torch.cuda.is_available():
        device = "mps" if torch.backends.mps.is_available() else "cpu"
    elif device == "mps" and not torch.backends.mps.is_available():
        device = "cpu"

    global layout_analyzer
    if layout_analyzer is None:
        try:
            layout_analyzer = LayoutAnalyzer(visualize=False, device=device)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to initialize LayoutAnalyzer: {str(e)}")

    content = await file.read()
    file_ext = Path(file.filename or "").suffix.lower()

    try:
        # 画像読み込み
        if file_ext == ".pdf":
            images = process_pdf_to_images(content, dpi=dpi)
        else:
            image = Image.open(io.BytesIO(content))
            if image.mode != "RGB":
                image = image.convert("RGB")
            image = normalize_image_dpi(image, dpi)
            images = [image]

        # ページごとにタイルをグループ化
        tiles_by_page = {}
        for spec in tile_specs:
            page_idx = spec["pageIndex"]
            if page_idx not in tiles_by_page:
                tiles_by_page[page_idx] = []
            tiles_by_page[page_idx].append(spec)

        # 各ページのタイルを処理
        pages: list[Page] = []
        for page_idx, img in enumerate(images):
            if page_idx not in tiles_by_page:
                continue

            img_array = np.array(img)
            page_width = img.width
            page_height = img.height
            
            all_blocks: list[Block] = []
            all_tables: list[Table] = []
            all_figures: list[Figure] = []
            
            # 各タイルを処理
            for tile_spec in tiles_by_page[page_idx]:
                bbox_norm = tile_spec["bboxNormalized"]
                
                # 正規化座標をピクセルに変換
                x_px = int(bbox_norm["x"] * page_width)
                y_px = int(bbox_norm["y"] * page_height)
                w_px = int(bbox_norm["w"] * page_width)
                h_px = int(bbox_norm["h"] * page_height)
                
                # タイル画像をクロップ
                tile_img = img_array[y_px:y_px+h_px, x_px:x_px+w_px]
                
                # レイアウト解析実行
                loop = asyncio.get_event_loop()
                tile_result = await loop.run_in_executor(
                    executor, partial(run_module_once, layout_analyzer, tile_img)
                )
                
                # タイル結果をページ座標にオフセット
                # 注: yomitoku_result_to_pageには実際のタイルサイズを渡す（ピクセル座標で返される）
                tile_page = yomitoku_result_to_page(
                    tile_result,
                    page_index=page_idx,
                    dpi=dpi,
                    width=w_px,
                    height=h_px,
                )
                
                # ブロックの座標をページ座標系に変換
                for block in tile_page.blocks:
                    # タイル内のピクセル座標をページのピクセル座標に変換してから正規化
                    block.bbox.x = (block.bbox.x + x_px) / page_width
                    block.bbox.y = (block.bbox.y + y_px) / page_height
                    block.bbox.w = block.bbox.w / page_width
                    block.bbox.h = block.bbox.h / page_height
                    
                    for line in block.lines:
                        line.bbox.x = (line.bbox.x + x_px) / page_width
                        line.bbox.y = (line.bbox.y + y_px) / page_height
                        line.bbox.w = line.bbox.w / page_width
                        line.bbox.h = line.bbox.h / page_height
                        
                        for token in line.tokens:
                            token.bbox.x = (token.bbox.x + x_px) / page_width
                            token.bbox.y = (token.bbox.y + y_px) / page_height
                            token.bbox.w = token.bbox.w / page_width
                            token.bbox.h = token.bbox.h / page_height
                    
                    all_blocks.append(block)
                
                # テーブルと図表も変換
                if tile_page.tables:
                    for table in tile_page.tables:
                        table.bbox.x = (table.bbox.x + x_px) / page_width
                        table.bbox.y = (table.bbox.y + y_px) / page_height
                        table.bbox.w = table.bbox.w / page_width
                        table.bbox.h = table.bbox.h / page_height
                        
                        for cell in table.cells:
                            cell["bbox"]["x"] = (cell["bbox"]["x"] + x_px) / page_width
                            cell["bbox"]["y"] = (cell["bbox"]["y"] + y_px) / page_height
                            cell["bbox"]["w"] = cell["bbox"]["w"] / page_width
                            cell["bbox"]["h"] = cell["bbox"]["h"] / page_height
                        
                        all_tables.append(table)
                
                if tile_page.figures:
                    for figure in tile_page.figures:
                        figure.bbox.x = (figure.bbox.x + x_px) / page_width
                        figure.bbox.y = (figure.bbox.y + y_px) / page_height
                        figure.bbox.w = figure.bbox.w / page_width
                        figure.bbox.h = figure.bbox.h / page_height
                        all_figures.append(figure)
            
            # タイル間の重複を除去
            deduplicated_blocks = deduplicate_blocks_by_iou(all_blocks, iou_threshold=0.5)
            
            page = Page(
                pageIndex=page_idx,
                dpi=dpi,
                widthPx=page_width,
                heightPx=page_height,
                blocks=deduplicated_blocks,
                tables=all_tables if all_tables else None,
                figures=all_figures if all_figures else None,
                readingOrder=None,
            )
            pages.append(page)

        processing_time = time.time() - start_time
        return OCRResponse(pages=pages, processingTime=processing_time, model="yomitoku-layout-tiles")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tile layout processing failed: {str(e)}")


def deduplicate_blocks_by_iou(blocks: list[Block], iou_threshold: float = 0.5) -> list[Block]:
    """
    重複するブロックをIoUベースで除去。
    信頼度が高い方、またはテキストが長い方を優先。
    """
    if len(blocks) <= 1:
        return blocks
    
    # 信頼度でソート（高い順）
    sorted_blocks = sorted(blocks, key=lambda b: (
        sum(t.confidence or 0.0 for line in b.lines for t in line.tokens) / max(1, sum(len(line.tokens) for line in b.lines)),
        len(b.text)
    ), reverse=True)
    
    kept_blocks = []
    for block in sorted_blocks:
        # 既に保持されているブロックと重複チェック
        is_duplicate = False
        for kept in kept_blocks:
            iou = calculate_bbox_iou(block.bbox, kept.bbox)
            if iou > iou_threshold:
                is_duplicate = True
                break
        
        if not is_duplicate:
            kept_blocks.append(block)
    
    return kept_blocks


def calculate_bbox_iou(bbox1: BBox, bbox2: BBox) -> float:
    """2つのBBoxのIoU（Intersection over Union）を計算"""
    # 交差領域を計算
    x1_inter = max(bbox1.x, bbox2.x)
    y1_inter = max(bbox1.y, bbox2.y)
    x2_inter = min(bbox1.x + bbox1.w, bbox2.x + bbox2.w)
    y2_inter = min(bbox1.y + bbox1.h, bbox2.y + bbox2.h)
    
    if x2_inter <= x1_inter or y2_inter <= y1_inter:
        return 0.0
    
    intersection = (x2_inter - x1_inter) * (y2_inter - y1_inter)
    area1 = bbox1.w * bbox1.h
    area2 = bbox2.w * bbox2.h
    union = area1 + area2 - intersection
    
    return intersection / union if union > 0 else 0.0


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "devices": {
            "cuda_available": torch.cuda.is_available(),
            "mps_available": torch.backends.mps.is_available(),
        },
        "models_loaded": {
            "standard": analyzer is not None,
            "lite": lite_analyzer is not None,
            "ocr_module": ocr_module is not None,
            "layout_analyzer": layout_analyzer is not None,
        },
    }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

