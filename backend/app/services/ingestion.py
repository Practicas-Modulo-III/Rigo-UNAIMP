import json
from pathlib import Path

import chromadb
import pdfplumber
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import Settings, get_settings
from app.database import SessionLocal
from app.models import IngestionLog
from app.services.embeddings_factory import get_embeddings

# Shared collection with chat retrieval (chat.py COLLECTION_NAME = "rigo_biblioteca_docs").
COLLECTION_NAME = "rigo_biblioteca_docs"
MIN_CHARS = 40
CHUNK_SIZE = 700
CHUNK_OVERLAP = 120
SPLITTER = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP, separators=["\n\n", "\n", ". ", " ", ""]
)

settings = get_settings()


def sanitize_utf8(text: str) -> str:
    """Strip invalid UTF-8 byte sequences so embeddings and Chroma never receive broken text."""
    if not text:
        return ""
    try:
        return text.encode("utf-8", errors="ignore").decode("utf-8", errors="ignore")
    except Exception:
        return ""


def extract_text_by_page(path: str) -> list[tuple[int, str]]:
    """Extract per-page text with pdfplumber; fall back to OCR (pytesseract, lang=spa) when too sparse."""
    pages: list[tuple[int, str]] = []
    try:
        with pdfplumber.open(path) as pdf:
            for index, page in enumerate(pdf.pages, start=1):
                text = sanitize_utf8(page.extract_text() or "")
                pages.append((index, text))
    except Exception:
        pages = []

    if sum(len(text) for _, text in pages) < MIN_CHARS:
        pages = _ocr_pages(path)
    return pages


def _ocr_pages(path: str) -> list[tuple[int, str]]:
    """Render each page to an image (pdf2image) and run tesseract with Spanish language model."""
    try:
        from pdf2image import convert_from_path

        import pytesseract
    except Exception as exc:
        return [(1, f"OCR unavailable for {Path(path).name}: {type(exc).__name__}")]

    pages: list[tuple[int, str]] = []
    try:
        images = convert_from_path(path, dpi=200)
        for index, image in enumerate(images, start=1):
            text = sanitize_utf8(pytesseract.image_to_string(image, lang="spa"))
            pages.append((index, text))
    except Exception as exc:
        pages = [(1, f"OCR failed for {Path(path).name}: {type(exc).__name__}")]
    return pages


def _split_chunks(page_number: int, page_text: str) -> list[tuple[int, int, str]]:
    """Split a single page into 700/120 chunks, each tagged with its page and sequence index."""
    chunks: list[tuple[int, int, str]] = []
    for offset, text in enumerate(SPLITTER.split_text(page_text)):
        text = sanitize_utf8(text)
        if text:
            chunks.append((page_number, offset, text))
    return chunks


async def _embed_chunk(embedder, text: str) -> list[float]:
    """Embed one chunk via Ollama nomic-embed-text (768 dims, validated)."""
    vector = await embedder.embed(sanitize_utf8(text))
    embedder.validate(vector)
    return vector


def _metadata_placeholder(payload: dict) -> dict:
    """Search descriptor for the D.L.822 gate (no content, only catalog metadata)."""
    parts = [payload.get("catalog_code", ""), payload.get("title", ""), payload.get("author", "")]
    return {
        "catalog_code": payload.get("catalog_code", ""),
        "title": payload.get("title", ""),
        "author": payload.get("author", ""),
        "pasillo": payload.get("pasillo"),
        "estante": payload.get("estante", ""),
        "location_tag": payload.get("tag_code", payload.get("location_tag", "")),
        "page": 0,
        "pdf_url": payload.get("pdf_url"),
        "rights_status": payload.get("rights_status", "free"),
        "_document": " ".join(p for p in parts if p),
    }


async def process_pdf_ingestion(log_id: int, path: str) -> None:
    """Real async PDF/OCR ingestion, safe to schedule via FastAPI BackgroundTasks."""
    session = SessionLocal()
    try:
        log = session.get(IngestionLog, log_id)
        if log is None:
            return

        payload = json.loads(log.payload) if log.payload else {}
        catalog_code = payload.get("catalog_code", payload.get("book_id", Path(log.filename).name))
        log.status = "processing"
        log.detail = f"Processing {log.filename} (D.L.822 rights={log.rights_status})"
        session.commit()

        client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIRECTORY)
        collection = client.get_or_create_collection(COLLECTION_NAME, metadata={"hnsw:space": "cosine"})
        embedder = get_embeddings(settings)

        # D.L.822 gate: restricted work with no file -> metadata only, no OCR / content indexing.
        if log.rights_status == "needs_authorization" and not Path(path).exists():
            holder = _metadata_placeholder(payload)
            collection.add(
                ids=[f"{catalog_code}_metadata"],
                embeddings=[await embedder.embed(holder["_document"])],
                documents=[holder["_document"]],
                metadatas=[{k: v for k, v in holder.items() if k != "_document"}],
            )
            log.status = "metadata_only"
            log.detail = "Metadata-only indexed (D.L.822 needs_authorization, no file attached)"
            session.commit()
            return

        pages = extract_text_by_page(path)
        indexed = 0
        for page_number, page_text in pages:
            for seq, chunk in _split_chunks(page_number, page_text):
                vector = await _embed_chunk(embedder, chunk)
                vector_id = f"{catalog_code}_p{page_number}_s{seq}"
                metadata = {
                    "catalog_code": catalog_code,
                    "title": payload.get("title", ""),
                    "author": payload.get("author", ""),
                    "pasillo": payload.get("pasillo"),
                    "estante": payload.get("estante", ""),
                    "location_tag": payload.get("tag_code", payload.get("location_tag", "")),
                    "page": page_number,
                    "pdf_url": payload.get("pdf_url"),
                    "rights_status": log.rights_status,
                }
                collection.add(ids=[vector_id], embeddings=[vector], documents=[chunk], metadatas=[metadata])
                indexed += 1

        log.status = "completed"
        log.detail = f"Extracted {len(pages)} pages, {indexed} chunks indexed ({settings.vector_provider})"
        session.commit()
    except Exception as exc:
        session.rollback()
        log = session.get(IngestionLog, log_id)
        if log is not None:
            log.status = "failed"
            log.detail = f"{type(exc).__name__}: {exc}"
            session.commit()
    finally:
        session.close()