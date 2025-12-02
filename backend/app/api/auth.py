from fastapi import APIRouter, Depends

from app.core.security import get_current_user


router = APIRouter()


@router.get("/me")
async def read_me(current_user=Depends(get_current_user)):
  """
  Return information about the currently authenticated user based on the Supabase JWT.
  """
  return current_user


