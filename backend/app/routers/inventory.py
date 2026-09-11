from pathlib import Path
from typing import Optional

import chromadb
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_session
from app.models import Book
from app.routers.auth import get_current_admin_user
from app.services.ingestion import COLLECTION_NAME

router = APIRouter(prefix="/api/inventory", tags=["inventory"])
settings = get_settings()


class BookListItem(BaseModel):
    catalog_code: str
    title: str
    author: str
    category: str
    year: int
    pasillo: int
    estante: str
    location_tag: str
    summary: str
    status: str
    quantity: int
    pdf_url: Optional[str] = None

    class Config:
        from_attributes = True


class BookUpdate(BaseModel):
    """Campos editables de la ficha. Todos opcionales: solo se aplica lo que llega."""

    title: Optional[str] = Field(None, min_length=1, max_length=300)
    author: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    year: Optional[int] = Field(None, ge=1000, le=2100)
    pasillo: Optional[int] = Field(None, ge=0, le=3)
    estante: Optional[str] = Field(None, min_length=1, max_length=100)
    location_tag: Optional[str] = Field(None, min_length=1, max_length=40)
    summary: Optional[str] = Field(None, max_length=2000)
    quantity: Optional[int] = Field(None, ge=1, le=999)
    status: Optional[str] = Field(None, pattern="^(available|in_use|reserved)$")


# La cita que redacta RIGO ("[Fuente: Título] — Pasillo X, Estante Y") sale de la metadata del
# fragmento, no de esta tabla: estos campos deben viajar también a Chroma al editarlos.
VECTOR_SYNCED_FIELDS = ("title", "author", "category", "pasillo", "estante", "location_tag")


def _open_collection():
    return chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIRECTORY).get_or_create_collection(
        COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
    )


def _sync_vector_metadata(catalog_code: str, changes: dict) -> int:
    """Propaga los campos editados a los fragmentos ya indexados del ejemplar.

    Se fusiona sobre la metadata existente en vez de reemplazarla: cada fragmento guarda su
    propia página, y sobrescribir el diccionario entero las pondría todas en la misma.
    """
    collection = _open_collection()
    existing = collection.get(where={"catalog_code": catalog_code}, include=["metadatas"])
    ids = existing.get("ids") or []
    metadatas = existing.get("metadatas") or []
    if not ids or len(ids) != len(metadatas):
        return 0
    collection.update(ids=ids, metadatas=[{**(meta or {}), **changes} for meta in metadatas])
    return len(ids)


@router.get("/")
def list_inventory(
    session: Session = Depends(get_session),
    category: Optional[str] = Query(None),
    pasillo: Optional[int] = Query(None),
    year_start: Optional[int] = Query(None),
    year_end: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> dict[str, int | list[BookListItem]]:
    stmt = select(Book)
    if category:
        stmt = stmt.where(Book.category == category)
    if pasillo is not None:
        stmt = stmt.where(Book.pasillo == pasillo)
    if year_start is not None:
        stmt = stmt.where(Book.year >= year_start)
    if year_end is not None:
        stmt = stmt.where(Book.year <= year_end)
    books = session.scalars(stmt.order_by(Book.catalog_code).limit(limit).offset(offset)).all()
    if stmt._where_criteria:
        total = session.scalar(select(func.count(Book.id)).where(*stmt._where_criteria))
    else:
        total = session.scalar(select(func.count(Book.id)))
    if total is None:
        total = len(books)
    return {"total": total, "items": [BookListItem.model_validate(b) for b in books]}


@router.patch("/{catalog_code}")
def update_book(
    catalog_code: str,
    payload: BookUpdate,
    session: Session = Depends(get_session),
    current_admin=Depends(get_current_admin_user),
) -> BookListItem:
    """Actualiza la ficha de un ejemplar y mantiene los vectores en sincronía."""
    book = session.scalar(select(Book).where(Book.catalog_code == catalog_code))
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No hay cambios que aplicar")

    for field, value in updates.items():
        setattr(book, field, value.strip() if isinstance(value, str) else value)

    # Los vectores se actualizan antes de confirmar en la base: si Chroma falla, la sesión se
    # cierra sin commit y ficha y fragmentos siguen coincidiendo, en vez de quedar divergentes.
    synced = {field: value for field, value in updates.items() if field in VECTOR_SYNCED_FIELDS}
    if synced:
        try:
            _sync_vector_metadata(catalog_code, synced)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"No se pudo actualizar la metadata indexada: {type(exc).__name__}",
            ) from exc

    session.commit()
    session.refresh(book)
    return BookListItem.model_validate(book)


@router.delete("/{catalog_code}")
def delete_book(
    catalog_code: str,
    session: Session = Depends(get_session),
    current_admin=Depends(get_current_admin_user),
) -> dict[str, object]:
    """Elimina un ejemplar del catálogo: ficha, vectores indexados y PDF en disco.

    Las tres cosas van juntas a propósito. Borrar solo la ficha dejaba los fragmentos vivos en
    Chroma y RIGO seguía citando un libro que ya no figura en el inventario; borrar solo los
    vectores dejaba el PDF ocupando disco sin que nada lo referenciara.
    """
    book = session.scalar(select(Book).where(Book.catalog_code == catalog_code))
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    # Primero los vectores: si esto falla, la ficha sigue en pie y el catálogo queda coherente.
    try:
        collection = _open_collection()
        before = collection.count()
        collection.delete(where={"catalog_code": catalog_code})
        vectors_removed = before - collection.count()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudieron borrar los vectores del ejemplar: {type(exc).__name__}",
        ) from exc

    file_removed = False
    if book.pdf_filename:
        storage_dir = (Path(settings.STORAGE_DIRECTORY) / "pdf").resolve()
        candidate = (storage_dir / Path(book.pdf_filename).name).resolve()
        # El nombre sale de nuestra propia base, pero igual se confirma que cae dentro de
        # storage antes de borrar nada del disco.
        if candidate.is_relative_to(storage_dir) and candidate.is_file():
            candidate.unlink()
            file_removed = True

    session.delete(book)
    session.commit()
    return {
        "catalog_code": catalog_code,
        "vectors_removed": vectors_removed,
        "pdf_removed": file_removed,
    }



