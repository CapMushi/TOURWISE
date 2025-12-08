from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field, field_validator
from decimal import Decimal

from app.core.security import get_current_user
from app.services.supabase_client import get_supabase_client


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


class UpdateBookingRequest(BaseModel):
    number_of_seats: Optional[int] = Field(None, gt=0)
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    special_requests: Optional[str] = None
    passengers: Optional[List[PassengerInfo]] = None


def generate_booking_reference() -> str:
    """Generate a unique booking reference in format: TW-{YEAR}-{SEQUENTIAL}"""
    current_year = datetime.now().year
    # For now, use timestamp-based sequential. In production, use a proper sequence
    sequential = int(datetime.now().timestamp() * 1000) % 1000000
    return f"TW-{current_year}-{sequential:06d}"


@router.post("/", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: CreateBookingRequest,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Create a new booking for a trip.
    Automatically processes payment (assumes successful).
    Updates available_seats on the trip.
    """
    user_id = current_user["id"]
    
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
            "currency": "USD",
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
        
        # Create notification
        agent_result = supabase.table("travel_agent").select("name").eq("agent_id", trip["agent_id"]).execute()
        agent_name = agent_result.data[0].get("name") if agent_result.data else None
        
        notification_data = {
            "booking_id": booking_id,
            "user_id": user_id,
            "notification_type": "booking_confirmed",
            "title": "Booking Confirmed",
            "message": f"Your booking {booking_reference} for {trip['origin_city']} → {trip['destination_city']} has been confirmed.",
            "is_read": False,
        }
        supabase.table("booking_notifications").insert(notification_data).execute()
        
        # Get agent name for response
        return BookingResponse(
            booking_id=booking_id,
            user_id=user_id,
            trip_id=booking_data.trip_id,
            itinerary_id=booking_data.itinerary_id,
            booking_date=datetime.fromisoformat(created_booking["booking_date"].replace("Z", "+00:00")),
            status=created_booking["status"],
            number_of_seats=created_booking["number_of_seats"],
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
                "price": float(trip["price"]),
            },
            agent_name=agent_name,
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
                    "price": float(trip["price"]),
                } if trip else None,
                agent_name=agent_name,
            ))
        
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
                "price": float(trip["price"]),
            } if trip else None,
            agent_name=agent_name,
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found",
            )
        
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
        notification_data = {
            "booking_id": booking_id,
            "user_id": user_id,
            "notification_type": "cancellation",
            "title": "Booking Cancelled",
            "message": f"Your booking {booking['booking_reference']} has been cancelled. Refund of ${booking['total_price']} will be processed.",
            "is_read": False,
        }
        supabase.table("booking_notifications").insert(notification_data).execute()
        
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
                "price": float(trip["price"]),
            },
            agent_name=agent_name,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error cancelling booking: {str(e)}",
        )

