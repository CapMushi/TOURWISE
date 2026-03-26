from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.security import get_current_user
from app.services.supabase_client import get_supabase_client

router = APIRouter()


class FavoriteTripItem(BaseModel):
    favorite_id: int
    trip_id: int
    created_at: datetime
    trip: Optional[dict] = None


class FavoriteStatusResponse(BaseModel):
    trip_id: int
    is_favorited: bool


@router.get("", response_model=List[FavoriteTripItem])
async def get_my_favorites(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]

    try:
        result = (
            supabase.table("favorites")
            .select("favorite_id, trip_id, created_at, trips(*)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )

        favorites: List[FavoriteTripItem] = []
        for row in result.data:
            trip_data = None
            if row.get("trips"):
                if isinstance(row["trips"], list) and len(row["trips"]) > 0:
                    trip_data = row["trips"][0]
                elif isinstance(row["trips"], dict):
                    trip_data = row["trips"]

            favorites.append(
                FavoriteTripItem(
                    favorite_id=row["favorite_id"],
                    trip_id=row["trip_id"],
                    created_at=row["created_at"],
                    trip=trip_data,
                )
            )

        return favorites
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching favorites: {str(e)}",
        )


@router.get("/{trip_id}/status", response_model=FavoriteStatusResponse)
async def get_favorite_status(
    trip_id: int,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]

    if trip_id < 0:
        return FavoriteStatusResponse(trip_id=trip_id, is_favorited=False)

    try:
        result = (
            supabase.table("favorites")
            .select("favorite_id")
            .eq("user_id", user_id)
            .eq("trip_id", trip_id)
            .limit(1)
            .execute()
        )
        return FavoriteStatusResponse(trip_id=trip_id, is_favorited=bool(result.data))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking favorite status: {str(e)}",
        )


@router.post("/{trip_id}", response_model=FavoriteStatusResponse, status_code=status.HTTP_201_CREATED)
async def add_favorite(
    trip_id: int,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]

    if trip_id < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wishlist is not available for external partner trips",
        )

    try:
        # Validate trip exists
        trip_result = supabase.table("trips").select("trip_id").eq("trip_id", trip_id).limit(1).execute()
        if not trip_result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        existing = (
            supabase.table("favorites")
            .select("favorite_id")
            .eq("user_id", user_id)
            .eq("trip_id", trip_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            return FavoriteStatusResponse(trip_id=trip_id, is_favorited=True)

        supabase.table("favorites").insert({"user_id": user_id, "trip_id": trip_id}).execute()
        return FavoriteStatusResponse(trip_id=trip_id, is_favorited=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding favorite: {str(e)}",
        )


@router.delete("/{trip_id}", response_model=FavoriteStatusResponse)
async def remove_favorite(
    trip_id: int,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]

    if trip_id < 0:
        return FavoriteStatusResponse(trip_id=trip_id, is_favorited=False)

    try:
        (
            supabase.table("favorites")
            .delete()
            .eq("user_id", user_id)
            .eq("trip_id", trip_id)
            .execute()
        )
        return FavoriteStatusResponse(trip_id=trip_id, is_favorited=False)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing favorite: {str(e)}",
        )
