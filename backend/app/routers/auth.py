from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_session
from app.models import User, get_password_hash, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()
security = HTTPBearer()
JWT_ALGORITHM = "HS256"


class LoginRequest(BaseModel):
    username: str
    password: str


class CredentialsUpdateRequest(BaseModel):
    current_password: str
    username: str | None = None
    new_password: str | None = None


def create_access_token(user: User) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    claims = {
        "sub": str(user.id),
        "username": user.username,
        "role": "admin",
        "exp": expires_at,
    }
    return jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_admin_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired administrator token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        subject = payload.get("sub")
        if not subject:
            raise unauthorized
        user = session.get(User, int(subject))
    except (JWTError, ValueError):
        raise unauthorized
    if user is None or not user.is_admin:
        raise unauthorized
    return user


@router.post("/login")
def login(credentials: LoginRequest, session: Session = Depends(get_session)) -> dict[str, str]:
    user = session.scalar(select(User).where(User.username == credentials.username))
    if user is None or not verify_password(credentials.password, user.password_hash) or not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {
        "access_token": create_access_token(user),
        "token_type": "bearer",
        "username": user.username,
    }


@router.get("/me")
def me(current_admin: User = Depends(get_current_admin_user)) -> dict[str, int | str]:
    return {"id": current_admin.id, "username": current_admin.username, "role": "admin"}


@router.patch("/credentials")
def update_credentials(
    payload: CredentialsUpdateRequest,
    current_admin: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    """Lets an authenticated administrator change their own login safely."""
    username = payload.username.strip() if payload.username is not None else current_admin.username
    username_changed = username != current_admin.username
    if not payload.current_password or not verify_password(payload.current_password, current_admin.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if not username:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Username cannot be empty")
    if len(username) > 80:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Username is too long")
    if payload.new_password is not None and len(payload.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="New password must contain at least 8 characters")
    if username_changed:
        existing = session.scalar(select(User).where(User.username == username))
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already in use")
        current_admin.username = username
    if payload.new_password:
        current_admin.password_hash = get_password_hash(payload.new_password)
    if payload.new_password is None and not username_changed:
        # Avoid accepting a no-op.
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Provide a new username or password")
    session.commit()
    session.refresh(current_admin)
    return {"username": current_admin.username, "access_token": create_access_token(current_admin)}
