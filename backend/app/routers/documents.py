import json
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_session
from app.models import Book, IngestionLog
from app.routers.auth import get_current_admin_user
from app.services.ingestion import process_pdf_ingestion

router = APIRouter(prefix="/api/documents", tags=["documents"])
settings = get_settings()
ALLOWED_RIGHTS_STATUSES = {"institutional", "public_domain", "needs_authorization"}


@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    file: UploadFile | None = File(None),
    book_id: str = Form(..., min_length=1, max_length=40),
    title: str = Form(..., min_length=1, max_length=300),
    author: str = Form(..., min_length=1, max_length=200),
    category: str = Form(..., min_length=1, max_length=100),
    year: int = Form(..., ge=1000, le=2100),
    pasillo: int = Form(..., ge=0, le=3),
    estante: str = Form(..., min_length=1, max_length=100),
    tag_code: str = Form(..., min_length=1, max_length=40),
    quantity: int = Form(1, ge=1, le=999),
    rights_status: str = Form("institutional"),
    current_admin=Depends(get_current_admin_user),
) -> dict[str, str | int]:
    """Register or update a catalog book, store its PDF and queue OCR asynchronously."""
    catalog_code = book_id.strip()
    if rights_status not in ALLOWED_RIGHTS_STATUSES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid rights status")

    file_path: Path | None = None
    stored_name: str | None = None
    pdf_url: str | None = None
    if file is not None and file.filename:
        safe_name = Path(file.filename).name
        if not safe_name.lower().endswith(".pdf") or file.content_type not in {"application/pdf", "application/x-pdf"}:
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Only PDF files are accepted")
        content = await file.read(settings.MAX_UPLOAD_MB * 1024 * 1024 + 1)
        if not content.startswith(b"%PDF-"):
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="The uploaded file is not a valid PDF")
        if len(content) > settings.MAX_UPLOAD_MB * 1024 * 1024:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"PDF exceeds the {settings.MAX_UPLOAD_MB} MB limit")
        storage_dir = Path(settings.STORAGE_DIRECTORY) / "pdf"
        storage_dir.mkdir(parents=True, exist_ok=True)
        stored_name = f"{uuid.uuid4().hex}_{safe_name}"
        file_path = storage_dir / stored_name
        file_path.write_bytes(content)
        pdf_url = f"/storage/pdf/{stored_name}"

    # Sin archivo se registra el ejemplar físico: solo ficha y ubicación, sin OCR ni contenido.

    book = session.scalar(select(Book).where(Book.catalog_code == catalog_code))
    if book is None:
        book = Book(
            catalog_code=catalog_code, title=title.strip(), author=author.strip(), category=category.strip(),
            year=year, pasillo=pasillo, estante=estante.strip(), location_tag=tag_code.strip(), quantity=quantity,
            summary=f"Documento incorporado al catálogo: {title.strip()}.", rights_status=rights_status,
            pdf_url=pdf_url, pdf_filename=stored_name,
        )
        session.add(book)
    else:
        book.title, book.author, book.category = title.strip(), author.strip(), category.strip()
        book.year, book.pasillo, book.estante = year, pasillo, estante.strip()
        book.location_tag, book.quantity, book.rights_status = tag_code.strip(), quantity, rights_status
        if pdf_url and stored_name:
            book.pdf_url, book.pdf_filename = pdf_url, stored_name

    payload = {
        "catalog_code": catalog_code, "title": title.strip(), "author": author.strip(), "category": category.strip(),
        "year": year, "pasillo": pasillo, "estante": estante.strip(), "tag_code": tag_code.strip(),
        "location_tag": tag_code.strip(), "quantity": quantity, "rights_status": rights_status, "pdf_url": pdf_url or "",
    }
    log = IngestionLog(
        filename=file.filename if file is not None else f"{catalog_code} (ejemplar físico)", rights_status=rights_status,
        status="queued", payload=json.dumps(payload, ensure_ascii=False), file_path=str(file_path) if file_path else None,
        detail=f"{'PDF stored and ' if file_path else 'Physical copy '}registered for ingest (D.L.822 rights={rights_status})",
    )
    session.add(log)
    session.commit()
    session.refresh(log)

    background_tasks.add_task(process_pdf_ingestion, log.id, str(file_path) if file_path else "")
    return {"log_id": log.id, "catalog_code": catalog_code, "status": "queued"}


@router.get("/logs")
def list_ingestion_logs(
    limit: int = 100,
    session: Session = Depends(get_session),
    current_admin=Depends(get_current_admin_user),
) -> dict[str, int | list[dict[str, object]]]:
    logs = session.scalars(select(IngestionLog).order_by(IngestionLog.created_at.desc()).limit(limit)).all()
    return {"count": len(logs), "logs": [{
        "id": log.id, "filename": log.filename, "rights_status": log.rights_status,
        "status": log.status, "detail": log.detail,
        "created_at": f"{log.created_at.isoformat()}Z" if log.created_at else None,
    } for log in logs]}
