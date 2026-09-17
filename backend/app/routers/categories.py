from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_session
from app.models import Book, Category
from app.routers.auth import get_current_admin_user

router = APIRouter(prefix="/api/categories", tags=["categories"])


class CategoryItem(BaseModel):
    id: int
    name: str
    book_count: int


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class CategoryUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


def _with_counts(session: Session) -> list[CategoryItem]:
    counts = dict(session.execute(select(Book.category, func.count(Book.id)).group_by(Book.category)).all())
    categories = session.scalars(select(Category).order_by(Category.name)).all()
    return [CategoryItem(id=c.id, name=c.name, book_count=counts.get(c.name, 0)) for c in categories]


@router.get("")
def list_categories(session: Session = Depends(get_session)) -> list[CategoryItem]:
    """Público: el kiosco (filtros de búsqueda) y el panel admin comparten esta lista."""
    return _with_counts(session)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    session: Session = Depends(get_session),
    current_admin=Depends(get_current_admin_user),
) -> CategoryItem:
    name = payload.name.strip()
    existing = session.scalar(select(Category).where(func.lower(Category.name) == name.lower()))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La categoría ya existe")
    category = Category(name=name)
    session.add(category)
    session.commit()
    session.refresh(category)
    return CategoryItem(id=category.id, name=category.name, book_count=0)


@router.patch("/{category_id}")
def rename_category(
    category_id: int,
    payload: CategoryUpdate,
    session: Session = Depends(get_session),
    current_admin=Depends(get_current_admin_user),
) -> CategoryItem:
    """Renombra la categoría y actualiza en cascada los libros que ya la usan.

    No hace falta tocar Chroma: category no viaja en la metadata del vector (solo en el catálogo
    SQL), así que renombrar acá no desincroniza las citas que arma RIGO.
    """
    category = session.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")
    new_name = payload.name.strip()
    duplicate = session.scalar(
        select(Category).where(func.lower(Category.name) == new_name.lower(), Category.id != category_id)
    )
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe una categoría con ese nombre")

    old_name = category.name
    category.name = new_name
    for book in session.scalars(select(Book).where(Book.category == old_name)):
        book.category = new_name
    session.commit()
    session.refresh(category)
    book_count = session.scalar(select(func.count(Book.id)).where(Book.category == new_name)) or 0
    return CategoryItem(id=category.id, name=category.name, book_count=book_count)


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    session: Session = Depends(get_session),
    current_admin=Depends(get_current_admin_user),
) -> dict[str, str]:
    category = session.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")
    in_use = session.scalar(select(func.count(Book.id)).where(Book.category == category.name)) or 0
    if in_use > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede borrar: {in_use} ejemplar(es) todavía usan esta categoría. Reasígnalos primero.",
        )
    session.delete(category)
    session.commit()
    return {"status": "deleted"}
