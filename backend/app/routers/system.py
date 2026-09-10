import platform
from datetime import datetime, timedelta

import chromadb
import httpx
import psutil
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_session
from app.models import Book, QueryLog
from app.routers.auth import get_current_admin_user
from app.routers.chat import retrieve_context
from app.services.embeddings_factory import EMBEDDING_DIMENSIONS
from app.services.ingestion import CHUNK_SIZE

router = APIRouter(prefix="/api/system", tags=["system"])
settings = get_settings()
COLLECTION_NAME = "rigo_biblioteca_docs"
HIGH_MATCH_THRESHOLD = 0.85
MODERATE_MATCH_THRESHOLD = 0.70


async def probe_ollama() -> dict[str, object]:
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            response.raise_for_status()
        return {"available": True, "detail": "Ollama responded"}
    except Exception as exc:
        return {"available": False, "detail": f"Ollama unavailable: {type(exc).__name__}"}


def chroma_vector_count() -> int:
    """Return the persistent Chroma count; unavailable stores remain observable as zero."""
    if settings.vector_provider != "chroma":
        return 0
    try:
        client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIRECTORY)
        collection = client.get_or_create_collection(COLLECTION_NAME, metadata={"hnsw:space": "cosine"})
        return collection.count()
    except Exception:
        return 0


@router.get("/metrics")
async def system_metrics(session: Session = Depends(get_session)) -> dict[str, object]:
    cpu_percent = psutil.cpu_percent(interval=None)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    total_books = session.scalar(select(func.count(Book.id))) or 0

    return {
        "cpu_percent": cpu_percent,
        "memory": {
            "percent": memory.percent,
            "total_mb": round(memory.total / 1024 / 1024, 1),
            "available_mb": round(memory.available / 1024 / 1024, 1),
        },
        "disk": {
            "free_gb": round(disk.free / 1024 / 1024 / 1024, 2),
            "percent": disk.percent,
        },
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "ollama_status": await probe_ollama(),
        "vector_provider": settings.vector_provider,
        "embed_dimensions": EMBEDDING_DIMENSIONS,
        "mode": "cloud" if settings.MODO_DEMO_CLOUD else "on-premise",
        "total_books": total_books,
        "total_vectors": chroma_vector_count(),
    }


@router.get("/query-stats")
async def query_stats(session: Session = Depends(get_session)) -> dict[str, object]:
    """Consultas hoy, tiempo de respuesta promedio y temas más consultados (últimos 7 días)."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    queries_today = session.scalar(select(func.count(QueryLog.id)).where(QueryLog.created_at >= today_start)) or 0
    avg_response_ms = session.scalar(
        select(func.avg(QueryLog.response_ms)).where(QueryLog.created_at >= today_start)
    )

    category_rows = session.execute(
        select(QueryLog.category, func.count(QueryLog.id))
        .where(QueryLog.created_at >= week_start, QueryLog.category.is_not(None))
        .group_by(QueryLog.category)
        .order_by(func.count(QueryLog.id).desc())
        .limit(3)
    ).all()
    total_categorized = sum(count for _, count in category_rows) or 1
    top_topics = [
        {"category": category, "count": count, "percent": round(count / total_categorized * 100)}
        for category, count in category_rows
    ]

    return {
        "queries_today": queries_today,
        "avg_response_seconds": round((avg_response_ms or 0) / 1000, 1),
        "top_topics": top_topics,
    }


class VectorInspectRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)


class VectorInspectResult(BaseModel):
    chunk_id: str
    catalog_code: str
    title: str
    page: int
    similarity: float
    match_label: str
    pasillo: int | None
    estante: str
    location_tag: str
    excerpt: str
    chunk_chars: int
    chunk_max_chars: int


class VectorInspectResponse(BaseModel):
    query: str
    embedding_model: str
    embedding_dimensions: int
    vector_provider: str
    distance_metric: str
    llm_model: str
    mode: str
    results: list[VectorInspectResult]


def match_label_for(similarity: float) -> str:
    if similarity >= HIGH_MATCH_THRESHOLD:
        return "High Match"
    if similarity >= MODERATE_MATCH_THRESHOLD:
        return "Moderate Match"
    return "Low Match"


@router.post("/vector-inspect")
async def vector_inspect(
    payload: VectorInspectRequest,
    current_admin=Depends(get_current_admin_user),
) -> VectorInspectResponse:
    """Admin diagnostic: run the same embed + Chroma/Pinecone retrieval used by /api/chat/stream
    without invoking the LLM, so staff can audit which chunks would ground a given answer."""
    raw_results = await retrieve_context(payload.question, None)
    items: list[VectorInspectResult] = []
    for item in raw_results[:3]:
        metadata = item["metadata"]
        document = item["document"]
        similarity = round(max(0.0, min(1.0, 1 - item["distance"])), 2)
        catalog_code = metadata.get("catalog_code", metadata.get("book_id", "s/c"))
        page = int(metadata.get("page") or 0)
        items.append(
            VectorInspectResult(
                chunk_id=f"{catalog_code}_p{page}",
                catalog_code=catalog_code,
                title=metadata.get("title", "Sin título"),
                page=page,
                similarity=similarity,
                match_label=match_label_for(similarity),
                pasillo=metadata.get("pasillo"),
                estante=metadata.get("estante", ""),
                location_tag=metadata.get("location_tag", metadata.get("tag_code", "")),
                excerpt=document[:400],
                chunk_chars=len(document),
                chunk_max_chars=CHUNK_SIZE,
            )
        )
    return VectorInspectResponse(
        query=payload.question,
        embedding_model=settings.OLLAMA_EMBED_MODEL,
        embedding_dimensions=EMBEDDING_DIMENSIONS,
        vector_provider=settings.vector_provider,
        distance_metric="cosine",
        llm_model=settings.GROQ_MODEL if settings.MODO_DEMO_CLOUD else settings.OLLAMA_CHAT_MODEL,
        mode="cloud" if settings.MODO_DEMO_CLOUD else "on-premise",
        results=items,
    )
