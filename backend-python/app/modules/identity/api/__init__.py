"""Identity HTTP API package."""

from fastapi import APIRouter

from app.modules.identity.api.auth import router as auth_router
from app.modules.identity.api.login_history import router as login_history_router
from app.modules.identity.api.me import router as me_router
from app.modules.identity.api.passwords import router as passwords_router
from app.modules.identity.api.sessions import router as sessions_router
from app.modules.identity.api.users import router as users_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(me_router)
router.include_router(users_router)
router.include_router(sessions_router)
router.include_router(login_history_router)
router.include_router(passwords_router)

__all__ = ["router"]
