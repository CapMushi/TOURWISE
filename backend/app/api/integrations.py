"""Debug/diagnostic endpoints for the Service Integration Layer."""

from typing import List

from fastapi import APIRouter, HTTPException, status

from app.integrations.base import CanonicalTripOffer
from app.integrations.registry import get_adapter, list_all_registered_adapters

router = APIRouter()


def _offer_to_public_dict(o: CanonicalTripOffer) -> dict:
    return {
        "trip_id": o.trip_id,
        "source": "external",
        "provider_id": o.provider_id,
        "external_ref": o.external_ref,
        "origin_city": o.origin_city,
        "destination_city": o.destination_city,
        "destination_province": o.destination_province,
        "price": str(o.price),
        "available_seats": o.available_seats,
    }


@router.get("/providers", response_model=List[str])
async def list_providers():
    return [a.provider_id for a in list_all_registered_adapters()]


@router.get("/{provider_id}/trips", response_model=List[dict])
async def list_provider_trips(provider_id: str):
    """Return canonical trip summaries for one provider (same data as merged /api/trips external rows)."""
    try:
        adapter = get_adapter(provider_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown provider_id")
    return [_offer_to_public_dict(o) for o in adapter.list_offers()]
