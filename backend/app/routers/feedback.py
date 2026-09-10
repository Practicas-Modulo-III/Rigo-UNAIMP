from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_session
from app.models import RAGFeedback

router = APIRouter(prefix="/api/feedback", tags=["feedback"])
settings = get_settings()


class FeedbackRequest(BaseModel):
    message_id: str = Field(min_length=1, max_length=100)
    rating: int = Field(ge=-1, le=1)
    comment: str | None = Field(default=None, max_length=1000)


class FeedbackResponse(BaseModel):
    id: int
    message_id: str
    rating: int
    comment: str | None
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/", status_code=status.HTTP_201_CREATED)
def submit_feedback(
    payload: FeedbackRequest,
    session: Session = Depends(get_session),
) -> FeedbackResponse:
    if payload.rating not in (-1, 0, 1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="rating must be -1 (dislike), 0 (neutral), or 1 (like)",
        )
    fb = RAGFeedback(message_id=payload.message_id, rating=payload.rating, comment=payload.comment)
    session.add(fb)
    session.commit()
    session.refresh(fb)
    return FeedbackResponse.model_validate(fb)