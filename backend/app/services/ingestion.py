import asyncio
import json
import re
import traceback
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

# Frases con las que un PDF intenta dar órdenes al modelo que luego lo cite como contexto.
# Deliberadamente específicas: "actúa como" o "sistema" sueltos aparecen en libros legítimos y
# marcarían media biblioteca. Los tokens de control de LLM no aparecen en un libro real jamás.
INJECTION_PATTERNS: tuple[tuple[str, str], ...] = (
    ("ignorar instrucciones previas", r"(ignor[ae]|olvid[ae])\s+(todas\s+)?(las\s+|tus\s+)?instrucciones\s+(anteriores|previas)"),
    ("ignore previous instructions", r"(ignore|disregard|forget)\s+(all\s+)?(the\s+)?(previous|prior|above)\s+instructions"),
    ("redefinición de rol", r"(a\s+partir\s+de\s+ahora\s+)?(eres|ser[áa]s)\s+ahora\s+un[ao]?\s"),
    ("role override", r"you\s+are\s+now\s+an?\s+\w+"),
    ("referencia al system prompt", r"(system\s+prompt|prompt\s+del\s+sistema|tus\s+instrucciones\s+de\s+sistema)"),
    ("pedido de revelar instrucciones", r"(revela|muestra|imprime|reveal|print|show)\s+(tus|las|your|the)\s+(instrucciones|instructions)"),
    ("token de control de LLM", r"(<\|im_start\|>|<\|im_end\|>|\[/?INST\]|<\s*/?\s*system\s*>)"),
)


class ExtractionError(Exception):
    """El PDF no se pudo leer ni por texto ni por OCR."""


def _scan_for_injection(pages: list[tuple[int, str]]) -> list[str]:
    """Busca intentos de prompt injection en el texto extraído.

    No bloquea la ingesta: un libro sobre seguridad en IA puede citar estas frases de forma
    legítima. Marca el documento para que el personal lo revise y lo borre si no corresponde.
    """
    found: list[str] = []
    for label, pattern in INJECTION_PATTERNS:
        for page_number, text in pages:
            if re.search(pattern, text, re.IGNORECASE):
                found.append(f"{label} (pág. {page_number})")
                break
    return found


def sanitize_utf8(text: str) -> str:
    """Strip invalid UTF-8 byte sequences so embeddings and Chroma never receive broken text."""
    if not text:
        return ""
    try:
        return text.encode("utf-8", errors="ignore").decode("utf-8", errors="ignore")
    except Exception:
        return ""


def extract_text_by_page(path: str) -> list[tuple[int, str]]:
    """Extract per-page text with pdfplumber; fall back to OCR (pytesseract, lang=spa) when too sparse.

    CPU-bound y bloqueante: invocar siempre con `asyncio.to_thread` desde código async.
    """
    pages: list[tuple[int, str]] = []
    try:
        with pdfplumber.open(path) as pdf:
            for index, page in enumerate(pdf.pages, start=1):
                text = sanitize_utf8(page.extract_text() or "")
                pages.append((index, text))
    except Exception:
        pages = []

    # Deciding OCR off the SUM across the whole document let a single page with real text (e.g.
    # a scan service's cover/notice page) mask a book that is otherwise 100% scanned images: the
    # sum cleared MIN_CHARS, so the other ~100 image-only pages never got OCR'd and the book
    # indexed with almost nothing. Trigger full-document OCR when most pages are sparse instead.
    sparse_pages = sum(1 for _, text in pages if len(text) < MIN_CHARS)
    if not pages or sparse_pages > len(pages) / 2:
        pages = _ocr_pages(path)
    return pages


def _ocr_pages(path: str) -> list[tuple[int, str]]:
    """Render each page to an image (pdf2image) and run tesseract with Spanish language model.

    Ante un fallo lanza ExtractionError en vez de devolver el mensaje de error como si fuera
    texto del libro: ese texto sintético terminaba embebido en Chroma y RIGO podía llegar a
    citarlo como si fuera un párrafo del ejemplar.
    """
    try:
        from pdf2image import convert_from_path

        import pytesseract
    except Exception as exc:
        raise ExtractionError(f"OCR no disponible en el contenedor: {type(exc).__name__}") from exc

    pages: list[tuple[int, str]] = []
    try:
        images = convert_from_path(path, dpi=200)
    except Exception as exc:
        raise ExtractionError(
            f"No se pudo leer el PDF ni por texto ni por OCR ({type(exc).__name__}): "
            "puede estar dañado o protegido."
        ) from exc

    for index, image in enumerate(images, start=1):
        try:
            # Tesseract has no internal deadline and can hang indefinitely on a pathological
            # page (dense noise, huge scan artifacts): a real ingestion once sat "processing"
            # for 2+ hours with 0% CPU on exactly this. A per-page timeout turns that into a
            # skipped page instead of a permanently stuck background task.
            text = sanitize_utf8(pytesseract.image_to_string(image, lang="spa", timeout=60))
        except RuntimeError:
            text = ""
        pages.append((index, text))
    return pages


def _split_chunks(page_text: str) -> list[tuple[int, str]]:
    """Split a single page into 700/120 chunks, each tagged with its sequence index."""
    chunks: list[tuple[int, str]] = []
    for offset, text in enumerate(SPLITTER.split_text(page_text)):
        text = sanitize_utf8(text)
        if text:
            chunks.append((offset, text))
    return chunks


async def _embed_chunk(embedder, text: str) -> list[float]:
    """Embed one chunk via Ollama nomic-embed-text (768 dims, validated)."""
    vector = await embedder.embed(sanitize_utf8(text))
    embedder.validate(vector)
    return vector


def _metadata_placeholder(payload: dict) -> dict:
    """Descriptor de búsqueda para ejemplares sin contenido indexable (libro físico sin escanear
    o restringido por D.L.822). El texto embebido incluye categoría y ubicación además del título:
    con solo el título, una pregunta temática ("libros sobre pintura") no alcanzaba el umbral de
    similitud y el ejemplar nunca se sugería."""
    title = payload.get("title", "")
    author = payload.get("author", "")
    category = payload.get("category", "")
    pasillo = payload.get("pasillo")
    estante = payload.get("estante", "")
    catalog_code = payload.get("catalog_code", "")
    document = ". ".join(
        part
        for part in [
            title,
            f"Autor: {author}" if author else "",
            f"Categoría: {category}" if category else "",
            f"Ubicación: Pasillo {pasillo}, {estante}" if estante else "",
            f"Código de catálogo: {catalog_code}" if catalog_code else "",
            "Ejemplar disponible para consulta en sala",
        ]
        if part
    )
    return {
        "catalog_code": catalog_code,
        "title": title,
        "author": author,
        "category": category,
        "pasillo": pasillo,
        "estante": estante,
        "location_tag": payload.get("tag_code", payload.get("location_tag", "")),
        "page": 0,
        "pdf_url": payload.get("pdf_url"),
        "rights_status": payload.get("rights_status", "free"),
        "_document": document,
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

        # Sin archivo (ejemplar físico sin digitalizar, o restringido por D.L.822) se indexa solo
        # la ficha: RIGO puede sugerirlo y decir dónde está, pero nunca cita contenido que no tiene.
        if not path or not Path(path).exists():
            holder = _metadata_placeholder(payload)
            await asyncio.to_thread(
                collection.add,
                ids=[f"{catalog_code}_metadata"],
                embeddings=[await embedder.embed(holder["_document"])],
                documents=[holder["_document"]],
                metadatas=[{k: v for k, v in holder.items() if k != "_document"}],
            )
            log.status = "metadata_only"
            log.detail = (
                f"Ficha indexada sin contenido (ejemplar físico, D.L.822 rights={log.rights_status})"
            )
            session.commit()
            return

        # PDFPlumber y Tesseract son CPU puro y el servidor corre en un solo proceso: sin sacarlos
        # del hilo del event loop, digitalizar un libro de cientos de páginas congelaba el chat
        # de todos los usuarios conectados (regla 2.4 de AGENTS.md).
        pages = await asyncio.to_thread(extract_text_by_page, path)

        total_chars = sum(len(text) for _, text in pages)
        if total_chars < MIN_CHARS:
            log.status = "failed"
            log.detail = (
                f"El PDF no contiene texto legible ({len(pages)} páginas, {total_chars} caracteres "
                "tras OCR). Puede estar en blanco, ser solo imágenes ilegibles o estar dañado. "
                "No se indexó nada."
            )
            session.commit()
            return

        suspicious = _scan_for_injection(pages)

        base_metadata = {
            "catalog_code": catalog_code,
            "title": payload.get("title", ""),
            "author": payload.get("author", ""),
            "pasillo": payload.get("pasillo"),
            "estante": payload.get("estante", ""),
            "location_tag": payload.get("tag_code", payload.get("location_tag", "")),
            "pdf_url": payload.get("pdf_url"),
            "rights_status": log.rights_status,
        }

        indexed = 0
        for page_number, page_text in pages:
            chunks = _split_chunks(page_text)
            if not chunks:
                continue
            ids: list[str] = []
            documents: list[str] = []
            embeddings: list[list[float]] = []
            metadatas: list[dict] = []
            for seq, chunk in chunks:
                embeddings.append(await _embed_chunk(embedder, chunk))
                ids.append(f"{catalog_code}_p{page_number}_s{seq}")
                documents.append(chunk)
                metadatas.append({**base_metadata, "page": page_number})
            # Una escritura por página en vez de una por fragmento: cada `add` toca disco y
            # reconstruye el índice HNSW, así que en lote es mucho más barato y no bloquea el loop.
            await asyncio.to_thread(
                collection.add, ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas
            )
            indexed += len(ids)

        summary = f"{len(pages)} páginas extraídas, {indexed} fragmentos indexados ({settings.vector_provider})"
        if suspicious:
            log.status = "flagged_review"
            log.detail = (
                f"{summary}. ⚠️ REVISAR: el documento contiene frases que parecen intentar dar "
                f"instrucciones al asistente ({'; '.join(suspicious)}). Está indexado y consultable: "
                "revisa el PDF y elimínalo del catálogo si no es material legítimo."
            )
        else:
            log.status = "completed"
            log.detail = summary
        session.commit()
    except ExtractionError as exc:
        # Fallo esperable de un archivo dañado: el admin necesita saber qué pasó, no un traceback.
        session.rollback()
        log = session.get(IngestionLog, log_id)
        if log is not None:
            log.status = "failed"
            log.detail = str(exc)
            session.commit()
    except Exception as exc:
        session.rollback()
        log = session.get(IngestionLog, log_id)
        if log is not None:
            log.status = "failed"
            log.detail = f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
            session.commit()
    finally:
        session.close()