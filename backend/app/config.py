from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    MODO_DEMO_CLOUD: bool = True
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-20b"
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_CHAT_MODEL: str = "qwen2.5:1.5b"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"
    EMBEDDING_DIMENSIONS: int = 768
    VECTOR_BACKEND: str = "chroma"
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_db"
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = ""
    DATABASE_URL: str = "sqlite:///./storage/rigo.db"
    STORAGE_DIRECTORY: str = "./storage"
    MAX_UPLOAD_MB: int = 50
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "1234"

    # Development default generated with `openssl rand -hex 32` (2026-09-04, replaces a value
    # that leaked into a local .env/chat transcript). Still: set a unique secret per deployment.
    JWT_SECRET_KEY: str = "9fc84c70ba40e03770a530fc29a5b27aea1573b374a37d37e8ca7408a1858021"
    JWT_EXPIRE_MINUTES: int = 60

    ALLOWED_ORIGINS: str = "http://localhost:5173"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def llm_provider(self) -> str:
        return "groq" if self.MODO_DEMO_CLOUD else "ollama"

    @property
    def vector_provider(self) -> str:
        return "pinecone" if self.MODO_DEMO_CLOUD and self.VECTOR_BACKEND == "pinecone" else "chroma"


@lru_cache
def get_settings() -> Settings:
    return Settings()
