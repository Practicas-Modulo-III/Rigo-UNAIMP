import httpx
from app.config import Settings
EMBEDDING_DIMENSIONS = 768
class OllamaEmbeddings:
    """nomic-embed-text via Ollama in both deployment modes."""
    def __init__(self, settings: Settings):
        if settings.EMBEDDING_DIMENSIONS != EMBEDDING_DIMENSIONS: raise ValueError("RIGO requires exactly 768 embedding dimensions")
        self.settings = settings
    async def embed(self, text: str) -> list[float]:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(f"{self.settings.OLLAMA_BASE_URL}/api/embeddings", json={"model":self.settings.OLLAMA_EMBED_MODEL,"prompt":text}); response.raise_for_status()
        vector = response.json()["embedding"]; self.validate(vector); return vector
    @staticmethod
    def validate(vector: list[float]) -> None:
        if len(vector) != EMBEDDING_DIMENSIONS: raise ValueError(f"Embedding dimension mismatch: expected 768, got {len(vector)}")
def get_embeddings(settings: Settings) -> OllamaEmbeddings: return OllamaEmbeddings(settings)
