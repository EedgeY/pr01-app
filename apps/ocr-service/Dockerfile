FROM python:3.11-slim

WORKDIR /app

# システム依存関係（poppler for pdf2image）
RUN apt-get update && apt-get install -y \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Python依存関係
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコード
COPY main.py .

# ポート公開
EXPOSE 8000

# 起動
CMD ["python", "main.py"]

