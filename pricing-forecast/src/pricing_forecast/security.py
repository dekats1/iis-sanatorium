"""Проверка JWT (HS256, RFC 7519/7518). Сервис сам проверяет токен и роль —
не доверяет заголовкам шлюза (раздел 2.4 главы 2)."""
from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from pricing_forecast.config import get_settings

_bearer = HTTPBearer(auto_error=False)


class CurrentUser:
    def __init__(self, sub: str, roles: list[str]):
        self.sub = sub
        self.roles = roles

    def has_role(self, role: str) -> bool:
        return role in self.roles


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Токен не предоставлен")
    settings = get_settings()
    try:
        payload = jwt.decode(creds.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Недействительный токен") from exc
    return CurrentUser(sub=payload["sub"], roles=payload.get("roles", []))


def require_role(role: str):
    def _checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not user.has_role(role):
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Требуется роль {role}")
        return user

    return _checker


# Внутренние вызовы core-service (POST /price/quote/batch) используют отдельную
# служебную роль "SERVICE_CORE", выданную тем же HS256-ключом при межсервисной аутентификации.
require_manager = require_role("MANAGER")
require_service = require_role("SERVICE_CORE")
