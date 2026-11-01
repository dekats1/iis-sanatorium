"""Проверка живости сервиса (используется compose/оркестратором при развёртывании, раздел 4.5 главы 4)."""
from fastapi import APIRouter

router = APIRouter(tags=["service"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "pricing-forecast"}
