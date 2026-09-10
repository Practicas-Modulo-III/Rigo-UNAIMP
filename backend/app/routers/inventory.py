from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_session
from app.models import Book
from app.routers.auth import get_current_admin_user

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
    pdf_url: Optional[str] = None

    class Config:
        from_attributes = True


class StatusUpdate(BaseModel):
    status: str = Field(pattern="^(available|in_use|reserved)$")


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


@router.patch("/{catalog_code}/status")
def update_book_status(
    catalog_code: str,
    payload: StatusUpdate,
    session: Session = Depends(get_session),
    current_admin=Depends(get_current_admin_user),
) -> BookListItem:
    book = session.scalar(select(Book).where(Book.catalog_code == catalog_code))
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    book.status = payload.status
    session.commit()
    session.refresh(book)
    return BookListItem.model_validate(book)

