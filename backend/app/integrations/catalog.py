"""Aggregate external offers from all registered mock/live adapters."""

from typing import List, Optional

from app.integrations.base import CanonicalTripOffer
from app.integrations.registry import list_all_registered_adapters


def all_external_offers() -> List[CanonicalTripOffer]:
    out: List[CanonicalTripOffer] = []
    for adapter in list_all_registered_adapters():
        out.extend(adapter.list_offers())
    return out


def get_external_offer_by_trip_id(trip_id: int) -> Optional[CanonicalTripOffer]:
    if trip_id >= 0:
        return None
    for o in all_external_offers():
        if o.trip_id == trip_id:
            return o
    return None


def is_external_trip_id(trip_id: int) -> bool:
    return trip_id < 0


def get_offer_by_provider_ref(provider_id: str, external_ref: str) -> Optional[CanonicalTripOffer]:
    for o in all_external_offers():
        if o.provider_id == provider_id and o.external_ref == external_ref:
            return o
    return None
