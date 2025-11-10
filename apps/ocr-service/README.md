# OCR Service (YomiToku)

FastAPI-based OCR microservice using YomiToku for Japanese document analysis.

## Features

- PDF and image (PNG, JPG) support
- DPI normalization for consistent bbox coordinates
- Layout analysis (blocks, lines, tokens)
- Table and figure detection
- Reading order estimation
- GPU/CPU support with automatic fallback
- Lite model for faster processing

## Setup

### Install Dependencies

```bash
pip install -r requirements.txt
```

**Note**: For PDF support, you also need `poppler-utils`:

- **macOS**: `brew install poppler`
- **Ubuntu/Debian**: `apt-get install poppler-utils`
- **Windows**: Download from [poppler releases](https://github.com/oschwartz10612/poppler-windows/releases)

### Install YomiToku

```bash
pip install yomitoku
```

For GPU support, ensure PyTorch with CUDA is installed:

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu124
```

## Running

### Development

```bash
python main.py
```

Server runs on `http://localhost:8000`

### Docker

```bash
docker build -t ocr-service .
docker run -p 8000:8000 ocr-service
```

## API

### POST /ocr

OCR a document and return structured data with bboxes.

**Request**:
- `file`: PDF or image file (multipart/form-data)
- `dpi`: Target DPI (default: 300)
- `device`: `cpu` or `cuda` (default: `cuda`)
- `lite`: Use lite model (default: `false`)

**Response**:
```json
{
  "pages": [
    {
      "pageIndex": 0,
      "dpi": 300,
      "widthPx": 2480,
      "heightPx": 3508,
      "blocks": [
        {
          "text": "申請書",
          "bbox": {"x": 100, "y": 50, "w": 200, "h": 40},
          "blockType": "title",
          "lines": [...]
        }
      ],
      "tables": [...],
      "figures": [...]
    }
  ],
  "processingTime": 2.34,
  "model": "yomitoku"
}
```

### GET /health

Health check endpoint.

## Integration

From Next.js:

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('dpi', '300');

const response = await fetch('http://localhost:8000/ocr', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
```

## References

- [YomiToku GitHub](https://github.com/kotaro-kinoshita/yomitoku)
- [YomiToku Documentation](https://kotaro-kinoshita.github.io/yomitoku/)



