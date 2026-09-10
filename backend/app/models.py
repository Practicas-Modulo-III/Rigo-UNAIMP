from datetime import datetime

from passlib.context import CryptContext
from sqlalchemy import Boolean, DateTime, Integer, String, Text, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.config import Settings
from app.database import Base

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(primary_key=True)
    catalog_code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    author: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    year: Mapped[int] = mapped_column(Integer)
    pasillo: Mapped[int] = mapped_column(Integer)
    estante: Mapped[str] = mapped_column(String(100))
    location_tag: Mapped[str] = mapped_column(String(40))
    summary: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="available")
    pdf_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    rights_status: Mapped[str] = mapped_column(String(50), default="institutional")
    # pdf_filename is the managed local copy permitted by the rights status.
    pdf_filename: Mapped[str | None] = mapped_column(String(500), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)


class IngestionLog(Base):
    __tablename__ = "ingestion_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(500))
    file_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    rights_status: Mapped[str] = mapped_column(String(40), default="free")
    payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="queued")
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CroquisState(Base):
    __tablename__ = "croquis_state"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    layout_json: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class QueryLog(Base):
    __tablename__ = "query_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    question: Mapped[str] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    response_ms: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class RAGFeedback(Base):
    __tablename__ = "rag_feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[str] = mapped_column(String(100), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


SEED_BOOKS = (
    {"catalog_code": "750.01", "title": "Tratado de la Pintura y del Paisaje", "author": "Leonardo Da Vinci", "category": "Talleres y Plástica", "year": 1978, "pasillo": 1, "estante": "Estante 2", "location_tag": "P1-E2", "summary": "Tratado clásico sobre composición, perspectiva y técnicas del paisaje."},
    {"catalog_code": "750.02", "title": "Temas Varios: Técnicas Mixtas", "author": "José María Parramón", "category": "Talleres y Plástica", "year": 1985, "pasillo": 1, "estante": "Estante 2", "location_tag": "P1-E2", "summary": "Manual práctico de acuarela, óleo, collage y técnicas mixtas."},
    {"catalog_code": "BIOG.01", "title": "Forma y Color. Giotto los Frescos de Asís", "author": "Sadea Ed.", "category": "Biografías", "year": 1975, "pasillo": 2, "estante": "Estante A", "location_tag": "P2-EA", "summary": "Análisis biográfico y visual de los frescos de Giotto en Asís."},
)


def seed_database(session: Session, settings: Settings) -> None:
    admin_user = session.scalar(select(User).where(User.username == settings.ADMIN_USERNAME))
    if admin_user is None:
        session.add(
            User(
                username=settings.ADMIN_USERNAME,
                password_hash=get_password_hash(settings.ADMIN_PASSWORD),
                is_admin=True,
            )
        )
    else:
        # Environment credentials bootstrap only the first administrator. Afterwards,
        # changes made through the protected admin panel remain persistent.
        admin_user.is_admin = True
    if session.scalar(select(func.count(Book.id))) == 0:
        session.add_all(Book(**book) for book in SEED_BOOKS)
    session.commit()
