from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.core.security import get_current_user
from app.services.recommendations import get_recommendations_for_user
from app.services.supabase_client import get_supabase_client

router = APIRouter()


class RecommendationsResponse(BaseModel):
    trips: List[Dict[str, Any]] = Field(default_factory=list)
    total: int
    ai_used: bool = False
    fallback_used: bool = True
    summary: str | None = None


@router.get("", response_model=RecommendationsResponse, status_code=status.HTTP_200_OK)
def get_recommendations(
    limit: int = Query(4, ge=1, le=20),
    user_query: str | None = Query(None, description="Optional natural-language recommendation intent"),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]
    result = get_recommendations_for_user(
        user_id=user_id,
        supabase=supabase,
        limit=limit,
        user_query=user_query,
    )
    return RecommendationsResponse(**result)

