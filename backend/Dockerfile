FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OLLAMA_HOST=0.0.0.0:11434

WORKDIR /code

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-spa \
    poppler-utils \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ollama/ollama:latest /bin/ollama /usr/local/bin/ollama
COPY --from=ollama/ollama:latest /usr/lib/ollama /usr/local/lib/ollama
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY start.sh ./start.sh
RUN chmod +x ./start.sh && mkdir -p /code/storage/pdf /code/chroma_db

# Preload both required local models during image construction.
RUN ollama serve >/tmp/ollama-build.log 2>&1 & \
    OLLAMA_PID=$!; \
    until ollama list >/dev/null 2>&1; do sleep 1; done; \
    ollama pull nomic-embed-text; \
    ollama pull qwen2.5:1.5b; \
    kill $OLLAMA_PID

EXPOSE 8000
VOLUME ["/code/storage", "/code/chroma_db"]

CMD ["./start.sh"]
