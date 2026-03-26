from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.security import get_current_user
from app.services.chat_rag import answer_with_rag, ingest_document
from app.services.supabase_client import get_supabase_client

router = APIRouter()


class ChatQueryRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User message for chatbot")
    category: Optional[str] = Field(None, description="Optional KB category filter")


class ChatSource(BaseModel):
    document_id: Optional[int] = None
    title: Optional[str] = None
    source_key: Optional[str] = None
    similarity: Optional[float] = None


class ChatQueryResponse(BaseModel):
    answer: str
    sources: List[ChatSource]
    used_context_count: int
    used_live_context: bool = False


class ChatIngestRequest(BaseModel):
    source_key: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    category: str = Field(default="general")
    content: str = Field(..., min_length=1)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ChatIngestResponse(BaseModel):
    document_id: int
    source_key: str
    chunk_count: int


@router.post("/query", response_model=ChatQueryResponse, status_code=status.HTTP_200_OK)
async def query_chatbot(
    payload: ChatQueryRequest,
    top_k: int = Query(5, ge=1, le=10),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]
    try:
        result = answer_with_rag(
            user_message=payload.message,
            supabase=supabase,
            top_k=top_k,
            category=payload.category,
            user_id=user_id,
        )
        return ChatQueryResponse(**result)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Chatbot service error: {exc}",
        ) from exc


@router.post("/ingest", response_model=ChatIngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest_chat_knowledge(
    payload: ChatIngestRequest,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    _ = current_user["id"]  # Keep auth requirement; role checks can be added later.
    try:
        result = ingest_document(
            supabase=supabase,
            source_key=payload.source_key,
            title=payload.title,
            content=payload.content,
            category=payload.category,
            metadata=payload.metadata,
        )
        return ChatIngestResponse(**result)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Chatbot ingest error: {exc}",
        ) from exc
