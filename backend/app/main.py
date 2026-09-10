from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.models import seed_database
from app.routers import auth, chat, croquis, documents, feedback, inventory, system
from app.services.embeddings_factory import EMBEDDING_DIMENSIONS

settings = get_settings()


async def probe_ollama() -> dict[str, object]:
    """Status probe only: failed local inference must not hide /health."""
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            response.raise_for_status()
        return {"available": True, "detail": "Ollama responded"}
    except Exception as exc:
        return {"available": False, "detail": f"Ollama unavailable: {type(exc).__name__}"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # New SQLite databases receive the complete current model; no migrations run here.
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        seed_database(session, settings)
    finally:
        session.close()
    app.state.ollama_status = await probe_ollama()
    yield


app = FastAPI(title="RIGO UNA v1", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
for router in (auth.router, chat.router, croquis.router, documents.router, inventory.router, feedback.router, system.router):
    app.include_router(router)


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "mode": "cloud" if settings.MODO_DEMO_CLOUD else "on-premise",
        "llm_provider": settings.llm_provider,
        "groq_model": settings.GROQ_MODEL,
        "ollama_chat_model": settings.OLLAMA_CHAT_MODEL,
        "ollama_embed_model": settings.OLLAMA_EMBED_MODEL,
        "ollama_status": getattr(app.state, "ollama_status", {"available": False, "detail": "not probed"}),
        "embed_dimensions": EMBEDDING_DIMENSIONS,
        "vector_provider": settings.vector_provider,
        "cloud_fallback": "ollama" if settings.MODO_DEMO_CLOUD else "not-applicable",
    }


class SPAStaticFiles(StaticFiles):
    """Falls back to index.html for client-side routes (/kiosk, /login, /admin)
    so a hard reload / direct link doesn't 404 — react-router owns those paths,
    not the filesystem. Real missing assets (a dotted filename, e.g. favicon.ico)
    still 404 normally."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            is_api = path == "api" or path.startswith("api/")
            is_asset = "." in path.rsplit("/", 1)[-1]
            if exc.status_code == 404 and not is_api and not is_asset:
                return await super().get_response("index.html", scope)
            raise


# Serve locally managed PDFs before the SPA fallback so /storage/pdf/... returns the file.
pdf_storage = Path(settings.STORAGE_DIRECTORY).resolve() / "pdf"
pdf_storage.mkdir(parents=True, exist_ok=True)
app.mount("/storage/pdf", StaticFiles(directory=str(pdf_storage)), name="pdf-storage")

# Single-port deployment: serve frontend dist at / (5670)
frontend_dist = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", SPAStaticFiles(directory=str(frontend_dist), html=True), name="frontend")
