from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.database import get_session
from app.models import CroquisState
from app.routers.auth import get_current_admin_user

router = APIRouter(prefix="/api/croquis", tags=["croquis"])

STATE_ID = 1


class ShelfNodePayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    name: str
    category: str
    description: str
    bookCount: int
    x: float
    y: float
    width: float
    height: float


class CroquisLayoutPayload(BaseModel):
    version: int
    canvasWidth: float
    canvasHeight: float
    shelves: list[ShelfNodePayload] = Field(default_factory=list)


@router.get("")
def get_croquis(session: Session = Depends(get_session)) -> dict[str, Any] | None:
    state = session.get(CroquisState, STATE_ID)
    if state is None:
        return None
    return CroquisLayoutPayload.model_validate_json(state.layout_json).model_dump()


@router.put("")
def put_croquis(
    payload: CroquisLayoutPayload,
    current_admin=Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    state = session.get(CroquisState, STATE_ID)
    layout_json = payload.model_dump_json()
    if state is None:
        state = CroquisState(id=STATE_ID, layout_json=layout_json)
        session.add(state)
    else:
        state.layout_json = layout_json
    session.commit()
    return payload.model_dump()
