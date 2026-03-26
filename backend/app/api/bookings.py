from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field, field_validator
from decimal import Decimal

from app.core.security import get_current_user
from app.services.supabase_client import get_supabase_client
from app.integrations.base import CanonicalTripOffer
from app.integrations.catalog import get_external_offer_by_trip_id, get_offer_by_provider_ref
from app.integrations.registry import get_adapter


router = APIRouter()


# Request/Response Models
class PassengerInfo(BaseModel):
    full_name: str = Field(..., min_length=1, description="Passenger's full name")
    age: Optional[int] = Field(None, ge=0, le=150, description="Passenger's age")
    gender: Optional[str] = Field(None, description="Gender: 'male', 'female', 'other'")
    passport_number: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    medical_conditions: Optional[str] = None


class CreateBookingRequest(BaseModel):
    trip_id: int = Field(..., description="Trip ID to book")
    number_of_seats: int = Field(..., gt=0, description="Number of seats to book")
    itinerary_id: Optional[int] = Field(None, description="Optional itinerary ID to add booking to")
    contact_email: str = Field(..., description="Contact email")
    contact_phone: str = Field(..., description="Contact phone number")
    special_requests: Optional[str] = None
    passengers: List[PassengerInfo] = Field(..., min_length=1, description="List of passenger information")
    
    @field_validator('passengers')
    def validate_passengers_count(cls, v, info):
        if 'number_of_seats' in info.data and len(v) != info.data['number_of_seats']:
            raise ValueError("Number of passengers must match number_of_seats")
        return v


class BookingResponse(BaseModel):
    booking_id: int
    user_id: str
    trip_id: int
    itinerary_id: Optional[int] = None
    booking_date: datetime
    status: str
    number_of_seats: int
    unit_price_at_booking: Optional[Decimal] = None
    total_price: Decimal
    passenger_names: List[str]
    contact_email: str
    contact_phone: str
    special_requests: Optional[str] = None
    booking_reference: str
    confirmed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    refund_amount: Optional[Decimal] = None
    updated_at: datetime
    trip: Optional[dict] = None  # Trip details
    agent_name: Optional[str] = None
    # "local" = public.booking; "external" = public.external_bookings
    booking_source: str = "local"


class UpdateBookingRequest(BaseModel):
    number_of_seats: Optional[int] = Field(None, gt=0)
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    special_requests: Optional[str] = None
    passengers: Optional[List[PassengerInfo]] = None


def _resolve_unit_price(booking: dict, trip: Optional[dict]) -> Decimal:
    """Prefer immutable booking snapshot; fall back to trip price for legacy rows."""
    if booking.get("unit_price_at_booking") is not None:
        return Decimal(str(booking["unit_price_at_booking"]))
    if booking.get("number_of_seats"):
        try:
            return Decimal(str(booking["total_price"])) / Decimal(str(booking["number_of_seats"]))
        except Exception:
            pass
    if trip and trip.get("price") is not None:
        return Decimal(str(trip["price"]))
    return Decimal("0")


def generate_booking_reference() -> str:
    """Generate a unique booking reference in format: TW-{YEAR}-{SEQUENTIAL}"""
    current_year = datetime.now().year
    # For now, use timestamp-based sequential. In production, use a proper sequence
    sequential = int(datetime.now().timestamp() * 1000) % 1000000
    return f"TW-{current_year}-{sequential:06d}"


def generate_external_booking_reference() -> str:
    current_year = datetime.now().year
    sequential = int(datetime.now().timestamp() * 1000) % 1000000
    return f"EXT-{current_year}-{sequential:06d}"


def _trip_dict_from_offer(offer: CanonicalTripOffer) -> dict:
    return {
        "trip_id": offer.trip_id,
        "origin_city": offer.origin_city,
        "destination_city": offer.destination_city,
        "departure_time": offer.departure_time.isoformat(),
        "arrival_time": offer.arrival_time.isoformat(),
        "price": float(offer.price),
    }


def _create_booking_notification(
    *,
    supabase,
    booking_id: int,
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
) -> None:
    """
    Best-effort notification insert.
    Booking/cancellation success should not fail if notification insert fails.
    """
    try:
        supabase.table("booking_notifications").insert(
            {
                "booking_id": booking_id,
                "user_id": user_id,
                "notification_type": notification_type,
                "title": title,
                "message": message,
                "is_read": False,
            }
        ).execute()
    except Exception:
        pass


def _external_booking_row_to_response(row: dict, offer: CanonicalTripOffer | None) -> BookingResponse:
    uid = row["user_id"]
    eid = row["external_booking_id"]
    syn = row.get("synthetic_trip_id")
    trip_id_val = int(syn) if syn is not None else (offer.trip_id if offer else 0)
    trip_dict = _trip_dict_from_offer(offer) if offer else None
    if trip_dict is None and syn is not None:
        trip_dict = {"trip_id": int(syn)}
    agent_name = offer.agent_name if offer else None
    bd = row["booking_date"]
    ua = row.get("updated_at", row["booking_date"])
    return BookingResponse(
        booking_id=eid,
        user_id=uid,
        trip_id=trip_id_val,
        itinerary_id=None,
        booking_date=datetime.fromisoformat(bd.replace("Z", "+00:00")),
        status=row["status"],
        number_of_seats=row["number_of_seats"],
        total_price=Decimal(str(row["total_price"])),
        passenger_names=row.get("passenger_names") or [],
        contact_email=row["contact_email"],
        contact_phone=row["contact_phone"],
        special_requests=row.get("special_requests"),
        booking_reference=row["booking_reference"],
        confirmed_at=datetime.fromisoformat(row["confirmed_at"].replace("Z", "+00:00")) if row.get("confirmed_at") else None,
        cancelled_at=datetime.fromisoformat(row["cancelled_at"].replace("Z", "+00:00")) if row.get("cancelled_at") else None,
        cancellation_reason=row.get("cancellation_reason"),
        refund_amount=Decimal(str(row["refund_amount"])) if row.get("refund_amount") is not None else None,
        updated_at=datetime.fromisoformat(ua.replace("Z", "+00:00")),
        trip=trip_dict,
        agent_name=agent_name,
        booking_source="external",
    )


async def _create_external_booking(
    booking_data: CreateBookingRequest,
    user_id: str,
    supabase,
) -> BookingResponse:
    offer = get_external_offer_by_trip_id(booking_data.trip_id)
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    if offer.available_seats < booking_data.number_of_seats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not enough available seats. Only {offer.available_seats} seats available.",
        )

    adapter = get_adapter(offer.provider_id)
    names = [p.full_name for p in booking_data.passengers]
    confirm = adapter.confirm_booking(offer.external_ref, booking_data.number_of_seats, names)
    if not confirm.ok:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=confirm.message or "External provider did not confirm the booking",
        )

    trip_price = offer.price
    total_price = trip_price * booking_data.number_of_seats
    booking_reference = generate_external_booking_reference()
    existing_ref = (
        supabase.table("external_bookings")
        .select("external_booking_id")
        .eq("booking_reference", booking_reference)
        .execute()
    )
    if existing_ref.data:
        booking_reference = generate_external_booking_reference()

    now_iso = datetime.utcnow().isoformat()
    insert_row = {
        "user_id": user_id,
        "provider_id": offer.provider_id,
        "external_ref": offer.external_ref,
        "synthetic_trip_id": booking_data.trip_id,
        "booking_date": now_iso,
        "status": "confirmed",
        "number_of_seats": booking_data.number_of_seats,
        "total_price": float(total_price),
        "passenger_names": names,
        "contact_email": booking_data.contact_email,
        "contact_phone": booking_data.contact_phone,
        "special_requests": booking_data.special_requests,
        "booking_reference": booking_reference,
        "provider_confirmation_ref": confirm.provider_confirmation_ref,
        "confirmed_at": now_iso,
        "provider_response": confirm.raw_response,
        "updated_at": now_iso,
    }
    booking_result = supabase.table("external_bookings").insert(insert_row).execute()
    if not booking_result.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create external booking")
    created = booking_result.data[0]
    eid = created["external_booking_id"]

    passengers_data = [
        {
            "external_booking_id": eid,
            "full_name": p.full_name,
            "age": p.age,
            "gender": p.gender,
            "passport_number": p.passport_number,
            "emergency_contact_name": p.emergency_contact_name,
            "emergency_contact_phone": p.emergency_contact_phone,
            "dietary_restrictions": p.dietary_restrictions,
            "medical_conditions": p.medical_conditions,
        }
        for p in booking_data.passengers
    ]
    if passengers_data:
        supabase.table("external_booking_passengers").insert(passengers_data).execute()

    supabase.table("external_payments").insert(
        {
            "external_booking_id": eid,
            "amount": float(total_price),
            "currency": "PKR",
            "payment_method": "card",
            "payment_status": "completed",
            "payment_date": now_iso,
            "transaction_id": f"TXN-{booking_reference}",
            "updated_at": now_iso,
        }
    ).execute()

    _create_booking_notification(
        supabase=supabase,
        booking_id=eid,
        user_id=user_id,
        notification_type="booking_confirmed",
        title="Booking Confirmed",
        message=(
            f"Your booking {booking_reference} for "
            f"{offer.origin_city} -> {offer.destination_city} has been confirmed."
        ),
    )

    return BookingResponse(
        booking_id=eid,
        user_id=user_id,
        trip_id=booking_data.trip_id,
        itinerary_id=None,
        booking_date=datetime.fromisoformat(created["booking_date"].replace("Z", "+00:00")),
        status=created["status"],
        number_of_seats=created["number_of_seats"],
        total_price=Decimal(str(created["total_price"])),
        passenger_names=created["passenger_names"],
        contact_email=created["contact_email"],
        contact_phone=created["contact_phone"],
        special_requests=created.get("special_requests"),
        booking_reference=created["booking_reference"],
        confirmed_at=datetime.fromisoformat(created["confirmed_at"].replace("Z", "+00:00")) if created.get("confirmed_at") else None,
        cancelled_at=None,
        cancellation_reason=None,
        refund_amount=None,
        updated_at=datetime.fromisoformat(created.get("updated_at", created["booking_date"]).replace("Z", "+00:00")),
        trip=_trip_dict_from_offer(offer),
        agent_name=offer.agent_name,
        booking_source="external",
    )


def _cancel_external_booking(
    booking_id: int,
    user_id: str,
    cancellation_reason: Optional[str],
    supabase,
) -> BookingResponse:
    ext_res = (
        supabase.table("external_bookings")
        .select("*")
        .eq("external_booking_id", booking_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not ext_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    row = ext_res.data[0]
    if row["status"] == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking is already cancelled")
    now_iso = datetime.utcnow().isoformat()
    supabase.table("external_bookings").update(
        {
            "status": "cancelled",
            "cancelled_at": now_iso,
            "cancellation_reason": cancellation_reason,
            "refund_amount": float(row["total_price"]),
            "updated_at": now_iso,
        }
    ).eq("external_booking_id", booking_id).execute()
    supabase.table("external_payments").update(
        {
            "payment_status": "refunded",
            "refunded_at": now_iso,
            "refund_amount": float(row["total_price"]),
            "updated_at": now_iso,
        }
    ).eq("external_booking_id", booking_id).execute()
    updated_res = supabase.table("external_bookings").select("*").eq("external_booking_id", booking_id).execute()
    updated = updated_res.data[0]
    offer = get_offer_by_provider_ref(updated["provider_id"], updated["external_ref"])
    origin_city = offer.origin_city if offer else "your selected origin"
    destination_city = offer.destination_city if offer else "your selected destination"
    _create_booking_notification(
        supabase=supabase,
        booking_id=booking_id,
        user_id=user_id,
        notification_type="cancellation",
        title="Booking Cancelled",
        message=(
            f"Your booking {updated['booking_reference']} for "
            f"{origin_city} -> {destination_city} has been cancelled. "
            f"Refund of PKR {updated['total_price']} will be processed."
        ),
    )
    return _external_booking_row_to_response(updated, offer)


@router.post("/", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: CreateBookingRequest,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Create a new booking for a trip.
    Local: processes payment, updates trips.available_seats.
    External (negative trip_id): confirms via integration adapter, then persists external_bookings.
    """
    user_id = current_user["id"]

    if booking_data.trip_id < 0:
        try:
            return await _create_external_booking(booking_data, user_id, supabase)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error creating external booking: {str(e)}",
            )
    
    try:
        # Get trip details
        trip_result = supabase.table("trips").select("*").eq("trip_id", booking_data.trip_id).execute()
        
        if not trip_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip not found",
            )
        
        trip = trip_result.data[0]
        
        # Validate available seats
        if trip["available_seats"] < booking_data.number_of_seats:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough available seats. Only {trip['available_seats']} seats available.",
            )
        
        # Calculate total price
        trip_price = Decimal(str(trip["price"]))
        total_price = trip_price * booking_data.number_of_seats
        
        # Generate booking reference
        booking_reference = generate_booking_reference()
        
        # Check if reference already exists (unlikely but possible)
        existing_ref = supabase.table("booking").select("booking_id").eq("booking_reference", booking_reference).execute()
        if existing_ref.data:
            # Regenerate if collision (very rare)
            booking_reference = generate_booking_reference()
        
        # Create booking
        booking_insert_data = {
            "user_id": user_id,
            "trip_id": booking_data.trip_id,
            "itinerary_id": booking_data.itinerary_id,
            "booking_date": datetime.utcnow().isoformat(),
            "status": "confirmed",  # Auto-confirm since payment is assumed successful
            "number_of_seats": booking_data.number_of_seats,
            "unit_price_at_booking": float(trip_price),
            "total_price": float(total_price),
            "passenger_names": [p.full_name for p in booking_data.passengers],
            "contact_email": booking_data.contact_email,
            "contact_phone": booking_data.contact_phone,
            "special_requests": booking_data.special_requests,
            "booking_reference": booking_reference,
            "confirmed_at": datetime.utcnow().isoformat(),
        }
        
        booking_result = supabase.table("booking").insert(booking_insert_data).execute()
        
        if not booking_result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create booking",
            )
        
        created_booking = booking_result.data[0]
        booking_id = created_booking["booking_id"]
        
        # Create passenger records
        if booking_data.passengers:
            passengers_data = []
            for passenger in booking_data.passengers:
                passengers_data.append({
                    "booking_id": booking_id,
                    "full_name": passenger.full_name,
                    "age": passenger.age,
                    "gender": passenger.gender,
                    "passport_number": passenger.passport_number,
                    "emergency_contact_name": passenger.emergency_contact_name,
                    "emergency_contact_phone": passenger.emergency_contact_phone,
                    "dietary_restrictions": passenger.dietary_restrictions,
                    "medical_conditions": passenger.medical_conditions,
                })
            
            if passengers_data:
                supabase.table("booking_passengers").insert(passengers_data).execute()
        
        # Create payment record (assume successful)
        payment_data = {
            "booking_id": booking_id,
            "amount": float(total_price),
            "currency": "PKR",
            "payment_method": "card",
            "payment_status": "completed",
            "payment_date": datetime.utcnow().isoformat(),
            "transaction_id": f"TXN-{booking_reference}",
        }
        supabase.table("payments").insert(payment_data).execute()
        
        # Update available seats on trip (decrement)
        new_available_seats = trip["available_seats"] - booking_data.number_of_seats
        supabase.table("trips").update({
            "available_seats": new_available_seats
        }).eq("trip_id", booking_data.trip_id).execute()
        
        # Notify traveler
        _create_booking_notification(
            supabase=supabase,
            booking_id=booking_id,
            user_id=user_id,
            notification_type="booking_confirmed",
            title="Booking Confirmed",
            message=f"Your booking {booking_reference} for {trip['origin_city']} -> {trip['destination_city']} has been confirmed.",
        )

        # Notify the travel agent that a new booking was made on their trip
        agent_result = supabase.table("travel_agent").select("name, user_id").eq("agent_id", trip["agent_id"]).execute()
        agent_name = agent_result.data[0].get("name") if agent_result.data else None
        if agent_result.data:
            agent_user_id = agent_result.data[0]["user_id"]
            passenger_names_str = ", ".join([p.full_name for p in booking_data.passengers])
            _create_booking_notification(
                supabase=supabase,
                booking_id=booking_id,
                user_id=agent_user_id,
                notification_type="new_booking",
                title="New Booking on Your Trip",
                message=(
                    f"{booking_data.number_of_seats} seat(s) booked on your trip "
                    f"{trip['origin_city']} → {trip['destination_city']} "
                    f"(Ref: {booking_reference}). Passengers: {passenger_names_str}."
                ),
            )
        
        # Get agent name for response
        return BookingResponse(
            booking_id=booking_id,
            user_id=user_id,
            trip_id=booking_data.trip_id,
            itinerary_id=booking_data.itinerary_id,
            booking_date=datetime.fromisoformat(created_booking["booking_date"].replace("Z", "+00:00")),
            status=created_booking["status"],
            number_of_seats=created_booking["number_of_seats"],
            unit_price_at_booking=_resolve_unit_price(created_booking, trip),
            total_price=Decimal(str(created_booking["total_price"])),
            passenger_names=created_booking["passenger_names"],
            contact_email=created_booking["contact_email"],
            contact_phone=created_booking["contact_phone"],
            special_requests=created_booking.get("special_requests"),
            booking_reference=created_booking["booking_reference"],
            confirmed_at=datetime.fromisoformat(created_booking["confirmed_at"].replace("Z", "+00:00")) if created_booking.get("confirmed_at") else None,
            cancelled_at=datetime.fromisoformat(created_booking["cancelled_at"].replace("Z", "+00:00")) if created_booking.get("cancelled_at") else None,
            cancellation_reason=created_booking.get("cancellation_reason"),
            refund_amount=Decimal(str(created_booking["refund_amount"])) if created_booking.get("refund_amount") else None,
            updated_at=datetime.fromisoformat(created_booking.get("updated_at", created_booking["booking_date"]).replace("Z", "+00:00")),
            trip={
                "trip_id": trip["trip_id"],
                "origin_city": trip["origin_city"],
                "destination_city": trip["destination_city"],
                "departure_time": trip["departure_time"],
                "arrival_time": trip["arrival_time"],
                "price": float(_resolve_unit_price(created_booking, trip)),
            },
            agent_name=agent_name,
            booking_source="local",
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating booking: {str(e)}",
        )


@router.get("/", response_model=List[BookingResponse])
async def get_my_bookings(
    status_filter: Optional[str] = Query(None, description="Filter by booking status"),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Get all bookings for the current user.
    """
    user_id = current_user["id"]
    
    try:
        query = supabase.table("booking").select("*").eq("user_id", user_id)
        
        if status_filter:
            query = query.eq("status", status_filter)
        
        result = query.order("booking_date", desc=True).execute()
        
        bookings = []
        for booking in result.data:
            # Get trip details
            trip_result = supabase.table("trips").select("*").eq("trip_id", booking["trip_id"]).execute()
            trip = trip_result.data[0] if trip_result.data else None
            
            # Get agent name
            agent_name = None
            if trip:
                agent_result = supabase.table("travel_agent").select("name").eq("agent_id", trip["agent_id"]).execute()
                agent_name = agent_result.data[0].get("name") if agent_result.data else None
            
            bookings.append(BookingResponse(
                booking_id=booking["booking_id"],
                user_id=booking["user_id"],
                trip_id=booking["trip_id"],
                itinerary_id=booking.get("itinerary_id"),
                booking_date=datetime.fromisoformat(booking["booking_date"].replace("Z", "+00:00")),
                status=booking["status"],
                number_of_seats=booking["number_of_seats"],
                unit_price_at_booking=_resolve_unit_price(booking, trip),
                total_price=Decimal(str(booking["total_price"])),
                passenger_names=booking.get("passenger_names", []),
                contact_email=booking["contact_email"],
                contact_phone=booking["contact_phone"],
                special_requests=booking.get("special_requests"),
                booking_reference=booking["booking_reference"],
                confirmed_at=datetime.fromisoformat(booking["confirmed_at"].replace("Z", "+00:00")) if booking.get("confirmed_at") else None,
                cancelled_at=datetime.fromisoformat(booking["cancelled_at"].replace("Z", "+00:00")) if booking.get("cancelled_at") else None,
                cancellation_reason=booking.get("cancellation_reason"),
                refund_amount=Decimal(str(booking["refund_amount"])) if booking.get("refund_amount") else None,
                updated_at=datetime.fromisoformat(booking.get("updated_at", booking["booking_date"]).replace("Z", "+00:00")),
                trip={
                    "trip_id": trip["trip_id"],
                    "origin_city": trip["origin_city"],
                    "destination_city": trip["destination_city"],
                    "departure_time": trip["departure_time"],
                    "arrival_time": trip["arrival_time"],
                    "price": float(_resolve_unit_price(booking, trip)),
                } if trip else None,
                agent_name=agent_name,
                booking_source="local",
            ))

        ext_query = supabase.table("external_bookings").select("*").eq("user_id", user_id)
        if status_filter:
            ext_query = ext_query.eq("status", status_filter)
        ext_result = ext_query.execute()
        for row in ext_result.data or []:
            offer = get_offer_by_provider_ref(row["provider_id"], row["external_ref"])
            bookings.append(_external_booking_row_to_response(row, offer))

        bookings.sort(key=lambda b: b.booking_date, reverse=True)
        return bookings
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching bookings: {str(e)}",
        )


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking_by_id(
    booking_id: int,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Get a specific booking by ID.
    Only the booking owner can access it.
    """
    user_id = current_user["id"]
    
    try:
        result = supabase.table("booking").select("*").eq("booking_id", booking_id).eq("user_id", user_id).execute()

        if not result.data:
            ext = (
                supabase.table("external_bookings")
                .select("*")
                .eq("external_booking_id", booking_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if ext.data:
                row = ext.data[0]
                offer = get_offer_by_provider_ref(row["provider_id"], row["external_ref"])
                return _external_booking_row_to_response(row, offer)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found",
            )
        
        booking = result.data[0]
        
        # Get trip details
        trip_result = supabase.table("trips").select("*").eq("trip_id", booking["trip_id"]).execute()
        trip = trip_result.data[0] if trip_result.data else None
        
        # Get agent name
        agent_name = None
        if trip:
            agent_result = supabase.table("travel_agent").select("name").eq("agent_id", trip["agent_id"]).execute()
            agent_name = agent_result.data[0].get("name") if agent_result.data else None
        
        return BookingResponse(
            booking_id=booking["booking_id"],
            user_id=booking["user_id"],
            trip_id=booking["trip_id"],
            itinerary_id=booking.get("itinerary_id"),
            booking_date=datetime.fromisoformat(booking["booking_date"].replace("Z", "+00:00")),
            status=booking["status"],
            number_of_seats=booking["number_of_seats"],
            unit_price_at_booking=_resolve_unit_price(booking, trip),
            total_price=Decimal(str(booking["total_price"])),
            passenger_names=booking.get("passenger_names", []),
            contact_email=booking["contact_email"],
            contact_phone=booking["contact_phone"],
            special_requests=booking.get("special_requests"),
            booking_reference=booking["booking_reference"],
            confirmed_at=datetime.fromisoformat(booking["confirmed_at"].replace("Z", "+00:00")) if booking.get("confirmed_at") else None,
            cancelled_at=datetime.fromisoformat(booking["cancelled_at"].replace("Z", "+00:00")) if booking.get("cancelled_at") else None,
            cancellation_reason=booking.get("cancellation_reason"),
            refund_amount=Decimal(str(booking["refund_amount"])) if booking.get("refund_amount") else None,
            updated_at=datetime.fromisoformat(booking.get("updated_at", booking["booking_date"]).replace("Z", "+00:00")),
            trip={
                "trip_id": trip["trip_id"],
                "origin_city": trip["origin_city"],
                "destination_city": trip["destination_city"],
                "departure_time": trip["departure_time"],
                "arrival_time": trip["arrival_time"],
                "price": float(_resolve_unit_price(booking, trip)),
            } if trip else None,
            agent_name=agent_name,
            booking_source="local",
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching booking: {str(e)}",
        )


@router.post("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking(
    booking_id: int,
    cancellation_reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Cancel a booking.
    Only the booking owner can cancel it.
    Updates available_seats on the trip.
    """
    user_id = current_user["id"]
    
    try:
        # Get booking
        booking_result = supabase.table("booking").select("*").eq("booking_id", booking_id).eq("user_id", user_id).execute()

        if not booking_result.data:
            return _cancel_external_booking(booking_id, user_id, cancellation_reason, supabase)
        
        booking = booking_result.data[0]
        
        # Check if already cancelled
        if booking["status"] == "cancelled":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking is already cancelled",
            )
        
        # Get trip to update available seats
        trip_result = supabase.table("trips").select("*").eq("trip_id", booking["trip_id"]).execute()
        
        if not trip_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip not found",
            )
        
        trip = trip_result.data[0]
        
        # Update booking status
        update_data = {
            "status": "cancelled",
            "cancelled_at": datetime.utcnow().isoformat(),
            "cancellation_reason": cancellation_reason,
            "refund_amount": float(booking["total_price"]),  # Full refund
        }
        
        supabase.table("booking").update(update_data).eq("booking_id", booking_id).execute()
        
        # Update available seats (increment)
        new_available_seats = trip["available_seats"] + booking["number_of_seats"]
        supabase.table("trips").update({
            "available_seats": new_available_seats
        }).eq("trip_id", booking["trip_id"]).execute()
        
        # Update payment status to refunded
        supabase.table("payments").update({
            "payment_status": "refunded",
            "refunded_at": datetime.utcnow().isoformat(),
            "refund_amount": float(booking["total_price"]),
        }).eq("booking_id", booking_id).execute()
        
        # Create notification
        _create_booking_notification(
            supabase=supabase,
            booking_id=booking_id,
            user_id=user_id,
            notification_type="cancellation",
            title="Booking Cancelled",
            message=(
                f"Your booking {booking['booking_reference']} for "
                f"{trip['origin_city']} -> {trip['destination_city']} has been cancelled. "
                f"Refund of PKR {booking['total_price']} will be processed."
            ),
        )
        
        # Get updated booking
        updated_booking_result = supabase.table("booking").select("*").eq("booking_id", booking_id).execute()
        updated_booking = updated_booking_result.data[0]
        
        # Get agent name
        agent_result = supabase.table("travel_agent").select("name").eq("agent_id", trip["agent_id"]).execute()
        agent_name = agent_result.data[0].get("name") if agent_result.data else None
        
        return BookingResponse(
            booking_id=updated_booking["booking_id"],
            user_id=updated_booking["user_id"],
            trip_id=updated_booking["trip_id"],
            itinerary_id=updated_booking.get("itinerary_id"),
            booking_date=datetime.fromisoformat(updated_booking["booking_date"].replace("Z", "+00:00")),
            status=updated_booking["status"],
            number_of_seats=updated_booking["number_of_seats"],
            unit_price_at_booking=_resolve_unit_price(updated_booking, trip),
            total_price=Decimal(str(updated_booking["total_price"])),
            passenger_names=updated_booking.get("passenger_names", []),
            contact_email=updated_booking["contact_email"],
            contact_phone=updated_booking["contact_phone"],
            special_requests=updated_booking.get("special_requests"),
            booking_reference=updated_booking["booking_reference"],
            confirmed_at=datetime.fromisoformat(updated_booking["confirmed_at"].replace("Z", "+00:00")) if updated_booking.get("confirmed_at") else None,
            cancelled_at=datetime.fromisoformat(updated_booking["cancelled_at"].replace("Z", "+00:00")) if updated_booking.get("cancelled_at") else None,
            cancellation_reason=updated_booking.get("cancellation_reason"),
            refund_amount=Decimal(str(updated_booking["refund_amount"])) if updated_booking.get("refund_amount") else None,
            updated_at=datetime.fromisoformat(updated_booking.get("updated_at", updated_booking["booking_date"]).replace("Z", "+00:00")),
            trip={
                "trip_id": trip["trip_id"],
                "origin_city": trip["origin_city"],
                "destination_city": trip["destination_city"],
                "departure_time": trip["departure_time"],
                "arrival_time": trip["arrival_time"],
                "price": float(_resolve_unit_price(updated_booking, trip)),
            },
            agent_name=agent_name,
            booking_source="local",
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error cancelling booking: {str(e)}",
        )


# ---------------------------------------------------------------------------
# Agent-facing: view all passengers booked on the agent's trips
# ---------------------------------------------------------------------------

class PassengerDetail(BaseModel):
    booking_id: int
    booking_reference: str
    booking_date: datetime
    status: str
    number_of_seats: int
    total_price: Decimal
    contact_email: str
    contact_phone: str
    special_requests: Optional[str] = None
    passengers: List[PassengerInfo]


class TripWithPassengers(BaseModel):
    trip_id: int
    origin_city: str
    destination_city: str
    departure_time: datetime
    arrival_time: datetime
    price: Decimal
    transport_type: str
    total_seats: int
    available_seats: int
    bookings: List[PassengerDetail]
    total_booked_seats: int


@router.get("/agent/passengers", response_model=List[TripWithPassengers])
async def get_agent_trip_passengers(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Return all trips owned by the current agent, each with their bookings and
    full passenger details.  Only accessible to travel agents.
    """
    try:
        agent_res = (
            supabase.table("travel_agent")
            .select("agent_id")
            .eq("user_id", current_user["id"])
            .execute()
        )
        if not agent_res.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a travel agent",
            )
        agent_id = agent_res.data[0]["agent_id"]

        trips_res = (
            supabase.table("trips")
            .select("*")
            .eq("agent_id", agent_id)
            .order("departure_time", desc=False)
            .execute()
        )
        trips = trips_res.data or []

        result: List[TripWithPassengers] = []
        for trip in trips:
            trip_id = trip["trip_id"]

            bookings_res = (
                supabase.table("booking")
                .select("*")
                .eq("trip_id", trip_id)
                .neq("status", "cancelled")
                .order("booking_date", desc=True)
                .execute()
            )
            bookings_raw = bookings_res.data or []

            trip_bookings: List[PassengerDetail] = []
            for b in bookings_raw:
                pax_res = (
                    supabase.table("booking_passengers")
                    .select("*")
                    .eq("booking_id", b["booking_id"])
                    .execute()
                )
                passengers: List[PassengerInfo] = [
                    PassengerInfo(
                        full_name=p["full_name"],
                        age=p.get("age"),
                        gender=p.get("gender"),
                        passport_number=p.get("passport_number"),
                        emergency_contact_name=p.get("emergency_contact_name"),
                        emergency_contact_phone=p.get("emergency_contact_phone"),
                        dietary_restrictions=p.get("dietary_restrictions"),
                        medical_conditions=p.get("medical_conditions"),
                    )
                    for p in (pax_res.data or [])
                ]
                trip_bookings.append(
                    PassengerDetail(
                        booking_id=b["booking_id"],
                        booking_reference=b["booking_reference"],
                        booking_date=datetime.fromisoformat(
                            b["booking_date"].replace("Z", "+00:00")
                        ),
                        status=b["status"],
                        number_of_seats=b["number_of_seats"],
                        total_price=Decimal(str(b["total_price"])),
                        contact_email=b["contact_email"],
                        contact_phone=b["contact_phone"],
                        special_requests=b.get("special_requests"),
                        passengers=passengers,
                    )
                )

            total_booked = sum(b.number_of_seats for b in trip_bookings)
            result.append(
                TripWithPassengers(
                    trip_id=trip_id,
                    origin_city=trip["origin_city"],
                    destination_city=trip["destination_city"],
                    departure_time=datetime.fromisoformat(
                        trip["departure_time"].replace("Z", "+00:00")
                    ),
                    arrival_time=datetime.fromisoformat(
                        trip["arrival_time"].replace("Z", "+00:00")
                    ),
                    price=Decimal(str(trip["price"])),
                    transport_type=trip["transport_type"],
                    total_seats=trip["total_seats"],
                    available_seats=trip["available_seats"],
                    bookings=trip_bookings,
                    total_booked_seats=total_booked,
                )
            )
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching agent passengers: {str(e)}",
        )
