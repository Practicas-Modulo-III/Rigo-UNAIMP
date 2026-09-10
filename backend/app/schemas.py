from pydantic import BaseModel, Field


class LocationDTO(BaseModel):
    pasillo: int
    estante: str
    tag_code: str


class BookDTO(BaseModel):
    catalog_code: str
    title: str
    author: str
    category: str
    year: int
    location: LocationDTO
    status: str
    summary: str
    pdf_url: str | None = None


class ChatFilters(BaseModel):
    category: str | None = None
    pasillo: str | int | None = None
    year_start: int | None = None
    year_end: int | None = None


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    filters: ChatFilters | None = None


class FeedbackRequest(BaseModel):
    message_id: str
    rating: int = Field(ge=-1, le=1)
    comment: str | None = None
