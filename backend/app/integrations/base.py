from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional


@dataclass
class CanonicalTripOffer:
    """TourWise-canonical trip fields for listing/detail (before Pydantic TripResponse)."""

    trip_id: int  # synthetic negative id
    provider_id: str
    external_ref: str
    departure_time: datetime
    arrival_time: datetime
    price: Decimal
    origin_city: str
    destination_province: str
    destination_city: str
    transport_type: str = "bus"
    total_seats: int = 40
    available_seats: int = 20
    created_at: Optional[datetime] = None
    agent_id: int = 0
    agent_name: Optional[str] = None
    image_url: Optional[str] = None
    suitability: Optional[str] = None
    image_gallery: List[str] = field(default_factory=list)


@dataclass
class BookingConfirmationResult:
    ok: bool
    provider_confirmation_ref: Optional[str] = None
    message: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None


class ExternalProviderAdapter(ABC):
    """Maps vendor-specific payloads to canonical types; mock or HTTP implementation."""

    provider_id: str

    @abstractmethod
    def list_offers(self) -> List[CanonicalTripOffer]:
        ...

    @abstractmethod
    def confirm_booking(
        self,
        external_ref: str,
        number_of_seats: int,
        passenger_names: List[str],
    ) -> BookingConfirmationResult:
        """Simulate partner confirmation; call only after validating request server-side."""
        ...

