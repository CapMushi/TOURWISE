"""
Mock external travel site API: vendor-shaped payloads → canonical TourWise offers.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List

from app.integrations.base import BookingConfirmationResult, CanonicalTripOffer, ExternalProviderAdapter

PROVIDER_ID = "mock_vendor_a"

# Simulated third-party JSON (different field names / nesting than TourWise)
_RAW_OFFERS: List[Dict[str, Any]] = [
    {
        "offerCode": "MV-KHI-ISB-01",
        "vendor": "MockPartner Tours",
        "route": {"from": "Karachi", "toCity": "Islamabad", "region": "Punjab"},
        "schedule": {"startISO": "2025-06-15T06:00:00+00:00", "endISO": "2025-06-15T18:00:00+00:00"},
        "pricing": {"perPersonPKR": 12500},
        "capacity": {"total": 45, "open": 32},
        "mode": "bus",
        "segment": "Solo Travelers",
    },
    {
        "offerCode": "MV-LHR-SKP-02",
        "vendor": "MockPartner Tours",
        "route": {"from": "Lahore", "toCity": "Skardu", "region": "Gilgit-Baltistan"},
        "schedule": {"startISO": "2025-07-01T05:30:00+00:00", "endISO": "2025-07-03T20:00:00+00:00"},
        "pricing": {"perPersonPKR": 89500},
        "capacity": {"total": 24, "open": 8},
        "mode": "tour",
        "segment": "Families",
    },
]


def _map_raw_to_canonical(raw: Dict[str, Any], synthetic_trip_id: int) -> CanonicalTripOffer:
    route = raw["route"]
    sched = raw["schedule"]
    cap = raw["capacity"]
    price = Decimal(str(raw["pricing"]["perPersonPKR"]))
    dep = datetime.fromisoformat(sched["startISO"].replace("Z", "+00:00"))
    arr = datetime.fromisoformat(sched["endISO"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    return CanonicalTripOffer(
        trip_id=synthetic_trip_id,
        provider_id=PROVIDER_ID,
        external_ref=str(raw["offerCode"]),
        departure_time=dep,
        arrival_time=arr,
        price=price,
        origin_city=str(route["from"]),
        destination_province=str(route["region"]),
        destination_city=str(route["toCity"]),
        transport_type=str(raw.get("mode", "bus")),
        total_seats=int(cap["total"]),
        available_seats=int(cap["open"]),
        created_at=now,
        agent_name=str(raw.get("vendor")),
        suitability=str(raw.get("segment")),
        image_gallery=[],
    )


class MockVendorAAdapter(ExternalProviderAdapter):
    provider_id = PROVIDER_ID

    def __init__(self) -> None:
        self._offers: List[CanonicalTripOffer] = []
        tid = -1
        for raw in _RAW_OFFERS:
            self._offers.append(_map_raw_to_canonical(raw, tid))
            tid -= 1

    def list_offers(self) -> List[CanonicalTripOffer]:
        return list(self._offers)

    def get_by_synthetic_id(self, trip_id: int) -> CanonicalTripOffer | None:
        for o in self._offers:
            if o.trip_id == trip_id:
                return o
        return None

    def confirm_booking(
        self,
        external_ref: str,
        number_of_seats: int,
        passenger_names: List[str],
    ) -> BookingConfirmationResult:
        # Simulate partner site confirmation
        exists = any(o.external_ref == external_ref for o in self._offers)
        if not exists:
            return BookingConfirmationResult(ok=False, message="Unknown offer code")
        if number_of_seats < 1:
            return BookingConfirmationResult(ok=False, message="Invalid seats")
        ref = f"P-{external_ref}-{int(datetime.now(timezone.utc).timestamp())}"
        return BookingConfirmationResult(
            ok=True,
            provider_confirmation_ref=ref,
            message="confirmed",
            raw_response={
                "partner": PROVIDER_ID,
                "offerCode": external_ref,
                "seats": number_of_seats,
                "guests": passenger_names,
                "partnerBookingRef": ref,
            },
        )


_mock_singleton: MockVendorAAdapter | None = None


def get_mock_vendor_a() -> MockVendorAAdapter:
    global _mock_singleton
    if _mock_singleton is None:
        _mock_singleton = MockVendorAAdapter()
    return _mock_singleton
