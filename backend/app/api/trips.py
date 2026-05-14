from datetime import datetime
from typing import Optional, List, Literal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field, field_validator, model_validator
from decimal import Decimal

from app.core.security import get_current_user
from app.services.supabase_client import get_supabase_client
from app.integrations.base import CanonicalTripOffer
from app.integrations.catalog import all_external_offers, get_external_offer_by_trip_id


router = APIRouter()


# Request/Response Models
class CreateTripRequest(BaseModel):
    origin_city: str = Field(..., min_length=1, description="Origin city of the trip")
    destination_province: str = Field(..., min_length=1, description="Destination province/state")
    destination_city: str = Field(..., min_length=1, description="Destination city")
    departure_time: datetime = Field(..., description="Scheduled departure time (ISO 8601 format)")
    arrival_time: datetime = Field(..., description="Scheduled arrival time (ISO 8601 format)")
    price: Decimal = Field(..., gt=0, description="Trip price (must be greater than 0)")
    transport_type: str = Field(..., description="Type of transportation")
    total_seats: int = Field(..., gt=0, description="Total number of seats (must be greater than 0)")
    available_seats: Optional[int] = Field(None, ge=0, description="Available seats (defaults to total_seats if not provided)")
    suitability: Optional[str] = Field(None, description="Suitability (Solo Travelers, Families, Couples)")

    @model_validator(mode="after")
    def validate_times_and_seats(self):
        """Validate arrival time and available seats."""
        # Validate arrival time is after departure time
        if self.arrival_time <= self.departure_time:
            raise ValueError("Arrival time must be after departure time")
        
        # Validate available_seats doesn't exceed total_seats
        if self.available_seats is not None and self.available_seats > self.total_seats:
            raise ValueError("Available seats cannot exceed total seats")
        
        # Set available_seats to total_seats if not provided
        if self.available_seats is None:
            self.available_seats = self.total_seats
        
        return self


class TripResponse(BaseModel):
    trip_id: int
    agent_id: int
    origin_city: str
    destination_province: str
    destination_city: str
    departure_time: datetime
    arrival_time: datetime
    price: Decimal
    transport_type: str
    total_seats: int
    available_seats: int
    created_at: datetime
    # Optional fields from joins
    agent_name: Optional[str] = None
    image_url: Optional[str] = None
    is_tour_package: Optional[bool] = None
    suitability: Optional[str] = None
    image_gallery: List[str] = []
    # Trip bundles (Phase 2): ordered member trip_ids when this row is a bundle anchor
    member_trip_ids: List[int] = Field(default_factory=list)
    # Service integration layer (local vs external)
    source: str = "local"
    provider_id: Optional[str] = None
    external_ref: Optional[str] = None

    class Config:
        from_attributes = True


class TripListResponse(BaseModel):
    trips: List[TripResponse]
    total: int
    page: int = 1
    page_size: Optional[int] = None
    total_pages: int = 1
    has_next_page: bool = False
    has_previous_page: bool = False


def _sort_trip_responses(trips: List[TripResponse], sort_by: str) -> List[TripResponse]:
    sorted_trips = list(trips)

    if sort_by == "price-low-high":
        return sorted(sorted_trips, key=lambda trip: (trip.price, trip.departure_time, trip.trip_id))
    if sort_by == "price-high-low":
        return sorted(
            sorted_trips,
            key=lambda trip: (-trip.price, trip.departure_time, trip.trip_id),
        )
    if sort_by == "availability":
        return sorted(
            sorted_trips,
            key=lambda trip: (-trip.available_seats, trip.departure_time, trip.trip_id),
        )
    if sort_by == "departure-soonest":
        return sorted(sorted_trips, key=lambda trip: (trip.departure_time, trip.trip_id))

    return sorted(
        sorted_trips,
        key=lambda trip: (
            0 if trip.source == "local" else 1,
            -trip.available_seats,
            trip.departure_time,
            trip.trip_id,
        ),
    )


def _canonical_offer_to_response(offer: CanonicalTripOffer) -> TripResponse:
    created = offer.created_at or offer.departure_time
    return TripResponse(
        trip_id=offer.trip_id,
        agent_id=offer.agent_id,
        origin_city=offer.origin_city,
        destination_province=offer.destination_province,
        destination_city=offer.destination_city,
        departure_time=offer.departure_time,
        arrival_time=offer.arrival_time,
        price=offer.price,
        transport_type=offer.transport_type,
        total_seats=offer.total_seats,
        available_seats=offer.available_seats,
        created_at=created,
        agent_name=offer.agent_name,
        image_url=offer.image_url,
        suitability=offer.suitability,
        image_gallery=list(offer.image_gallery),
        source="external",
        provider_id=offer.provider_id,
        external_ref=offer.external_ref,
    )


def _external_offer_matches_filters(
    offer: CanonicalTripOffer,
    *,
    has_filters: bool,
    destination_province: Optional[str],
    destination_city: Optional[str],
    origin_city: Optional[str],
    transport_type: Optional[str],
    price_min: Optional[float],
    price_max: Optional[float],
    departure_date_from: Optional[datetime],
    departure_date_to: Optional[datetime],
    min_available_seats: Optional[int],
    suitability: Optional[str],
) -> bool:
    if has_filters and offer.available_seats <= 0:
        return False
    if destination_province and destination_province.strip():
        dp = (offer.destination_province or "").lower()
        if destination_province.strip().lower() not in dp:
            return False
    if destination_city and destination_city.strip():
        dc = offer.destination_city.lower()
        if destination_city.strip().lower() not in dc:
            return False
    if origin_city and origin_city.strip():
        oc = offer.origin_city.lower()
        if origin_city.strip().lower() not in oc:
            return False
    if transport_type and transport_type.lower() != "any":
        if offer.transport_type.lower() != transport_type.lower():
            return False
    if price_min is not None and float(offer.price) < price_min:
        return False
    if price_max is not None and float(offer.price) > price_max:
        return False
    if departure_date_from and offer.departure_time < departure_date_from:
        return False
    if departure_date_to and offer.departure_time > departure_date_to:
        return False
    if min_available_seats is not None and offer.available_seats < min_available_seats:
        return False
    if suitability and suitability.strip() and suitability.lower() != "any":
        if (offer.suitability or "") != suitability:
            return False
    return True


def _fetch_trip_images_map(supabase, trip_ids: List[int]) -> dict[int, List[str]]:
    if not trip_ids:
        return {}

    result = (
        supabase.table("trip_images")
        .select("trip_id, image_url, sort_order, created_at")
        .in_("trip_id", trip_ids)
        .order("sort_order", desc=False)
        .order("created_at", desc=False)
        .execute()
    )

    images_map: dict[int, List[str]] = {}
    for row in result.data:
        t_id = row["trip_id"]
        images_map.setdefault(t_id, []).append(row["image_url"])
    return images_map


@router.get("", response_model=TripListResponse)
async def get_trips(
    destination_province: Optional[str] = Query(None, description="Filter by destination province"),
    destination_city: Optional[str] = Query(None, description="Filter by destination city"),
    origin_city: Optional[str] = Query(None, description="Filter by origin city"),
    transport_type: Optional[str] = Query(None, description="Filter by transport type"),
    price_min: Optional[float] = Query(None, ge=0, description="Minimum price"),
    price_max: Optional[float] = Query(None, ge=0, description="Maximum price"),
    departure_date_from: Optional[datetime] = Query(None, description="Filter trips departing after this date"),
    departure_date_to: Optional[datetime] = Query(None, description="Filter trips departing before this date"),
    min_available_seats: Optional[int] = Query(None, ge=0, description="Minimum available seats"),
    suitability: Optional[str] = Query(None, description="Filter by suitability (Solo Travelers, Families, Couples)"),
    sort_by: Literal["recommended", "departure-soonest", "price-low-high", "price-high-low", "availability"] = Query(
        "recommended",
        description="Sort option for trip listings",
    ),
    page: Optional[int] = Query(None, ge=1, description="Page number for paginated results"),
    page_size: Optional[int] = Query(None, ge=1, le=48, description="Page size for paginated results"),
):
    """
    Get all available trips with optional filters for search functionality.
    Only returns trips with available_seats > 0 when filters are provided.
    If no filters are provided, returns all trips ordered by trip_id.
    """
    supabase = get_supabase_client()
    should_paginate = page is not None or page_size is not None
    resolved_page = page or 1
    resolved_page_size = page_size or 12
    
    # Check if any filters are provided
    has_filters = any([
        destination_province,
        destination_city,
        origin_city,
        transport_type and transport_type.lower() != "any",
        price_min is not None,
        price_max is not None,
        departure_date_from,
        departure_date_to,
        min_available_seats is not None,
        suitability and suitability.lower() != "any",
    ])
    
    # Start building query
    query = supabase.table("trips").select(
        """
        *,
        travel_agent:agent_id (
            name,
            email
        )
        """
    )
    count_query = supabase.table("trips").select("trip_id", count="exact").limit(1)
    
    # Only filter by available_seats if filters are provided
    # If no filters, show all trips (including those with 0 available seats)
    if has_filters:
        query = query.gt("available_seats", 0)
        count_query = count_query.gt("available_seats", 0)
    
    # Apply filters
    if destination_province:
        query = query.ilike("destination_province", f"%{destination_province}%")
        count_query = count_query.ilike("destination_province", f"%{destination_province}%")
    if destination_city:
        query = query.ilike("destination_city", f"%{destination_city}%")
        count_query = count_query.ilike("destination_city", f"%{destination_city}%")
    if origin_city:
        query = query.ilike("origin_city", f"%{origin_city}%")
        count_query = count_query.ilike("origin_city", f"%{origin_city}%")
    if transport_type and transport_type.lower() != "any":
        query = query.eq("transport_type", transport_type.lower())
        count_query = count_query.eq("transport_type", transport_type.lower())
    if price_min is not None:
        query = query.gte("price", price_min)
        count_query = count_query.gte("price", price_min)
    if price_max is not None:
        query = query.lte("price", price_max)
        count_query = count_query.lte("price", price_max)
    if departure_date_from:
        query = query.gte("departure_time", departure_date_from.isoformat())
        count_query = count_query.gte("departure_time", departure_date_from.isoformat())
    if departure_date_to:
        query = query.lte("departure_time", departure_date_to.isoformat())
        count_query = count_query.lte("departure_time", departure_date_to.isoformat())
    if min_available_seats is not None:
        query = query.gte("available_seats", min_available_seats)
        count_query = count_query.gte("available_seats", min_available_seats)
    if suitability and suitability.lower() != "any":
        query = query.eq("suitability", suitability)
        count_query = count_query.eq("suitability", suitability)
    
    if sort_by == "price-low-high":
        query = query.order("price", desc=False).order("departure_time", desc=False).order("trip_id", desc=False)
    elif sort_by == "price-high-low":
        query = query.order("price", desc=True).order("departure_time", desc=False).order("trip_id", desc=False)
    elif sort_by == "availability":
        query = query.order("available_seats", desc=True).order("departure_time", desc=False).order("trip_id", desc=False)
    else:
        query = query.order("departure_time", desc=False).order("trip_id", desc=False)
    
    try:
        local_total_result = count_query.execute()
        local_total = local_total_result.count or 0

        external_trips: List[TripResponse] = []
        for offer in all_external_offers():
            if _external_offer_matches_filters(
                offer,
                has_filters=has_filters,
                destination_province=destination_province,
                destination_city=destination_city,
                origin_city=origin_city,
                transport_type=transport_type,
                price_min=price_min,
                price_max=price_max,
                departure_date_from=departure_date_from,
                departure_date_to=departure_date_to,
                min_available_seats=min_available_seats,
                suitability=suitability,
            ):
                external_trips.append(_canonical_offer_to_response(offer))

        external_total = len(external_trips)
        total = local_total + external_total
        effective_page_size = resolved_page_size if should_paginate else max(total, 1)
        total_pages = max((total + effective_page_size - 1) // effective_page_size, 1)
        current_page = min(resolved_page, total_pages) if should_paginate else 1

        if should_paginate and total > 0:
            end_index = current_page * resolved_page_size
            fetch_limit = min(local_total, end_index + external_total)
            if fetch_limit > 0:
                query = query.range(0, fetch_limit - 1)

        result = query.execute()
        trip_ids = [trip_row["trip_id"] for trip_row in result.data]
        images_map = _fetch_trip_images_map(supabase, trip_ids)
        
        trips = []
        for trip_data in result.data:
            # Extract agent name if available
            agent_name = None
            if trip_data.get("travel_agent"):
                if isinstance(trip_data["travel_agent"], list) and len(trip_data["travel_agent"]) > 0:
                    agent_name = trip_data["travel_agent"][0].get("name")
                elif isinstance(trip_data["travel_agent"], dict):
                    agent_name = trip_data["travel_agent"].get("name")
            
            trip = TripResponse(
                trip_id=trip_data["trip_id"],
                agent_id=trip_data["agent_id"],
                origin_city=trip_data["origin_city"],
                destination_province=trip_data["destination_province"],
                destination_city=trip_data["destination_city"],
                departure_time=datetime.fromisoformat(trip_data["departure_time"].replace("Z", "+00:00")),
                arrival_time=datetime.fromisoformat(trip_data["arrival_time"].replace("Z", "+00:00")),
                price=Decimal(str(trip_data["price"])),
                transport_type=trip_data["transport_type"],
                total_seats=trip_data["total_seats"],
                available_seats=trip_data["available_seats"],
                created_at=datetime.fromisoformat(trip_data["created_at"].replace("Z", "+00:00")),
                agent_name=agent_name,
                image_url=trip_data.get("image_url") or (images_map.get(trip_data["trip_id"], [None])[0]),
                is_tour_package=trip_data.get("is_tour_package"),
                suitability=trip_data.get("suitability"),
                image_gallery=images_map.get(trip_data["trip_id"], []),
                member_trip_ids=trip_data.get("member_trip_ids") or [],
            )
            trips.append(trip)

        trips.extend(external_trips)
        trips = _sort_trip_responses(trips, sort_by)

        if should_paginate:
            start_index = (current_page - 1) * resolved_page_size
            end_index = start_index + resolved_page_size
            trips = trips[start_index:end_index]

        return TripListResponse(
            trips=trips,
            total=total,
            page=current_page,
            page_size=effective_page_size,
            total_pages=total_pages,
            has_next_page=current_page < total_pages,
            has_previous_page=current_page > 1,
        )
    
    except Exception as e:
        print(f"Error fetching trips: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch trips: {str(e)}",
        )


@router.get("/my-trips", response_model=TripListResponse)
async def get_my_trips(
    current_user: dict = Depends(get_current_user),
):
    """
    Get all trips created by the authenticated travel agent.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Check if user is a registered travel agent
    agent_result = supabase.table("travel_agent").select("agent_id").eq("user_id", user_id).execute()

    if not agent_result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a registered travel agent.",
        )

    agent_id = agent_result.data[0]["agent_id"]

    try:
        # Get all trips for this agent (including those with 0 available seats)
        result = supabase.table("trips").select("*").eq("agent_id", agent_id).order("created_at", desc=True).execute()
        trip_ids = [trip_row["trip_id"] for trip_row in result.data]
        images_map = _fetch_trip_images_map(supabase, trip_ids)

        trips = []
        for trip_data in result.data:
            trip = TripResponse(
                trip_id=trip_data["trip_id"],
                agent_id=trip_data["agent_id"],
                origin_city=trip_data["origin_city"],
                destination_province=trip_data["destination_province"],
                destination_city=trip_data["destination_city"],
                departure_time=datetime.fromisoformat(trip_data["departure_time"].replace("Z", "+00:00")),
                arrival_time=datetime.fromisoformat(trip_data["arrival_time"].replace("Z", "+00:00")),
                price=Decimal(str(trip_data["price"])),
                transport_type=trip_data["transport_type"],
                total_seats=trip_data["total_seats"],
                available_seats=trip_data["available_seats"],
                created_at=datetime.fromisoformat(trip_data["created_at"].replace("Z", "+00:00")),
                image_url=trip_data.get("image_url") or (images_map.get(trip_data["trip_id"], [None])[0]),
                is_tour_package=trip_data.get("is_tour_package"),
                suitability=trip_data.get("suitability"),
                image_gallery=images_map.get(trip_data["trip_id"], []),
                member_trip_ids=trip_data.get("member_trip_ids") or [],
            )
            trips.append(trip)

        return TripListResponse(trips=trips, total=len(trips))

    except Exception as e:
        print(f"Error fetching agent trips: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch trips: {str(e)}",
        )


@router.post("", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
async def create_trip(
    trip_data: CreateTripRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Create a new trip for the authenticated travel agent.
    
    Requires:
    - Valid JWT token
    - User must be a registered travel agent
    
    Returns:
    - Created trip with all details including trip_id and created_at
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Check if user is a registered travel agent
    agent_result = supabase.table("travel_agent").select("agent_id").eq("user_id", user_id).execute()

    if not agent_result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a registered travel agent. Please complete agent verification first.",
        )

    agent_id = agent_result.data[0]["agent_id"]

    # Prepare trip data for insertion
    # Handle suitability: database has NOT NULL constraint, so we must provide a value
    # Valid enum values: 'Solo Travelers', 'Families', 'Couples'
    # If "Any" or None/empty, we'll use "Solo Travelers" as default
    suitability_value = None
    if trip_data.suitability and trip_data.suitability.strip() and trip_data.suitability != "Any":
        suitability_value = trip_data.suitability
    else:
        # Default to "Solo Travelers" if not specified (since column is NOT NULL)
        suitability_value = "Solo Travelers"
    
    trip_insert_data = {
        "agent_id": agent_id,
        "origin_city": trip_data.origin_city,
        "destination_province": trip_data.destination_province,
        "destination_city": trip_data.destination_city,
        "departure_time": trip_data.departure_time.isoformat(),
        "arrival_time": trip_data.arrival_time.isoformat(),
        "price": float(trip_data.price),  # Convert Decimal to float for Supabase
        "transport_type": trip_data.transport_type,
        "total_seats": trip_data.total_seats,
        "available_seats": trip_data.available_seats,
        "suitability": suitability_value,
    }

    # Insert trip into database
    try:
        result = supabase.table("trips").insert(trip_insert_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create trip. No data returned from database.",
            )

        created_trip = result.data[0]
        images_map = _fetch_trip_images_map(supabase, [created_trip["trip_id"]])

        # Convert back to response model
        return TripResponse(
            trip_id=created_trip["trip_id"],
            agent_id=created_trip["agent_id"],
            origin_city=created_trip["origin_city"],
            destination_province=created_trip["destination_province"],
            destination_city=created_trip["destination_city"],
            departure_time=datetime.fromisoformat(created_trip["departure_time"].replace("Z", "+00:00")),
            arrival_time=datetime.fromisoformat(created_trip["arrival_time"].replace("Z", "+00:00")),
            price=Decimal(str(created_trip["price"])),
            transport_type=created_trip["transport_type"],
            total_seats=created_trip["total_seats"],
            available_seats=created_trip["available_seats"],
            created_at=datetime.fromisoformat(created_trip["created_at"].replace("Z", "+00:00")),
            image_url=created_trip.get("image_url") or (images_map.get(created_trip["trip_id"], [None])[0]),
            is_tour_package=created_trip.get("is_tour_package"),
            suitability=created_trip.get("suitability"),
            image_gallery=images_map.get(created_trip["trip_id"], []),
            member_trip_ids=created_trip.get("member_trip_ids") or [],
        )

    except Exception as e:
        # Log the error (in production, use proper logging)
        print(f"Error creating trip: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create trip: {str(e)}",
        )


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip_by_id(
    trip_id: int,
):
    """
    Get a single trip by trip_id.
    Includes agent information.
    Negative trip_id: external (integration layer) synthetic id.
    """
    if trip_id < 0:
        ext = get_external_offer_by_trip_id(trip_id)
        if not ext:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip with ID {trip_id} not found",
            )
        return _canonical_offer_to_response(ext)

    supabase = get_supabase_client()
    
    try:
        result = supabase.table("trips").select(
            """
            *,
            travel_agent:agent_id (
                name,
                email
            )
            """
        ).eq("trip_id", trip_id).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip with ID {trip_id} not found",
            )
        
        trip_data = result.data[0]
        
        # Extract agent name if available
        agent_name = None
        if trip_data.get("travel_agent"):
            if isinstance(trip_data["travel_agent"], list) and len(trip_data["travel_agent"]) > 0:
                agent_name = trip_data["travel_agent"][0].get("name")
            elif isinstance(trip_data["travel_agent"], dict):
                agent_name = trip_data["travel_agent"].get("name")
        images_map = _fetch_trip_images_map(supabase, [trip_id])
        
        return TripResponse(
            trip_id=trip_data["trip_id"],
            agent_id=trip_data["agent_id"],
            origin_city=trip_data["origin_city"],
            destination_province=trip_data["destination_province"],
            destination_city=trip_data["destination_city"],
            departure_time=datetime.fromisoformat(trip_data["departure_time"].replace("Z", "+00:00")),
            arrival_time=datetime.fromisoformat(trip_data["arrival_time"].replace("Z", "+00:00")),
            price=Decimal(str(trip_data["price"])),
            transport_type=trip_data["transport_type"],
            total_seats=trip_data["total_seats"],
            available_seats=trip_data["available_seats"],
            created_at=datetime.fromisoformat(trip_data["created_at"].replace("Z", "+00:00")),
            agent_name=agent_name,
            image_url=trip_data.get("image_url") or (images_map.get(trip_id, [None])[0]),
            is_tour_package=trip_data.get("is_tour_package"),
            suitability=trip_data.get("suitability"),
            image_gallery=images_map.get(trip_id, []),
            member_trip_ids=trip_data.get("member_trip_ids") or [],
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching trip {trip_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch trip: {str(e)}",
        )


class UpdateTripRequest(BaseModel):
    image_url: Optional[str] = None


class TripImageCreateRequest(BaseModel):
    image_url: str
    alt_text: Optional[str] = None
    sort_order: int = 0
    is_cover: bool = False


class TripImageResponse(BaseModel):
    image_id: int
    trip_id: int
    image_url: str
    alt_text: Optional[str] = None
    sort_order: int
    is_cover: bool
    created_at: datetime


@router.get("/{trip_id}/images", response_model=List[TripImageResponse])
async def get_trip_images(trip_id: int):
    supabase = get_supabase_client()

    try:
        trip_result = supabase.table("trips").select("trip_id").eq("trip_id", trip_id).limit(1).execute()
        if not trip_result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        result = (
            supabase.table("trip_images")
            .select("image_id, trip_id, image_url, alt_text, sort_order, is_cover, created_at")
            .eq("trip_id", trip_id)
            .order("sort_order", desc=False)
            .order("created_at", desc=False)
            .execute()
        )
        return [TripImageResponse(**row) for row in result.data]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch trip images: {str(e)}",
        )


@router.post("/{trip_id}/images", response_model=TripImageResponse, status_code=status.HTTP_201_CREATED)
async def create_trip_image(
    trip_id: int,
    payload: TripImageCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Verify trip ownership (agent only)
    trip_result = supabase.table("trips").select("agent_id").eq("trip_id", trip_id).limit(1).execute()
    if not trip_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    agent_result = supabase.table("travel_agent").select("agent_id").eq("user_id", user_id).limit(1).execute()
    if not agent_result.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not a registered travel agent.")

    if trip_result.data[0]["agent_id"] != agent_result.data[0]["agent_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to add images for this trip.")

    try:
        if payload.is_cover:
            supabase.table("trip_images").update({"is_cover": False}).eq("trip_id", trip_id).eq("is_cover", True).execute()

        insert_result = (
            supabase.table("trip_images")
            .insert(
                {
                    "trip_id": trip_id,
                    "image_url": payload.image_url,
                    "alt_text": payload.alt_text,
                    "sort_order": payload.sort_order,
                    "is_cover": payload.is_cover,
                    "created_by": user_id,
                }
            )
            .execute()
        )
        if not insert_result.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create trip image")

        created = insert_result.data[0]

        # Keep backward compatibility by syncing cover image to trips.image_url
        if payload.is_cover:
            supabase.table("trips").update({"image_url": payload.image_url}).eq("trip_id", trip_id).execute()

        return TripImageResponse(**created)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create trip image: {str(e)}",
        )


@router.patch("/{trip_id}", response_model=TripResponse)
async def update_trip(
    trip_id: int,
    update_data: UpdateTripRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Update trip details, including image URL.
    Only the agent who created the trip can update it.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Verify trip exists and get agent_id
    trip_result = supabase.table("trips").select("agent_id").eq("trip_id", trip_id).execute()
    
    if not trip_result.data or len(trip_result.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} not found",
        )
    
    trip_agent_id = trip_result.data[0]["agent_id"]
    
    # Check if user is a registered travel agent
    agent_result = supabase.table("travel_agent").select("agent_id").eq("user_id", user_id).execute()
    
    if not agent_result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a registered travel agent.",
        )
    
    user_agent_id = agent_result.data[0]["agent_id"]
    
    # Verify user is the agent who created this trip
    if trip_agent_id != user_agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this trip. Only the trip creator can update it.",
        )

    # Prepare update data
    update_dict = {}
    if update_data.image_url is not None:
        update_dict["image_url"] = update_data.image_url

    if not update_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    try:
        # Update trip
        result = supabase.table("trips").update(update_dict).eq("trip_id", trip_id).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update trip",
            )
        
        updated_trip = result.data[0]
        
        # Get agent name for response
        agent_name_result = supabase.table("travel_agent").select("name").eq("agent_id", trip_agent_id).execute()
        agent_name = None
        if agent_name_result.data:
            agent_name = agent_name_result.data[0].get("name")
        images_map = _fetch_trip_images_map(supabase, [trip_id])
        
        return TripResponse(
            trip_id=updated_trip["trip_id"],
            agent_id=updated_trip["agent_id"],
            origin_city=updated_trip["origin_city"],
            destination_province=updated_trip["destination_province"],
            destination_city=updated_trip["destination_city"],
            departure_time=datetime.fromisoformat(updated_trip["departure_time"].replace("Z", "+00:00")),
            arrival_time=datetime.fromisoformat(updated_trip["arrival_time"].replace("Z", "+00:00")),
            price=Decimal(str(updated_trip["price"])),
            transport_type=updated_trip["transport_type"],
            total_seats=updated_trip["total_seats"],
            available_seats=updated_trip["available_seats"],
            created_at=datetime.fromisoformat(updated_trip["created_at"].replace("Z", "+00:00")),
            agent_name=agent_name,
            image_url=updated_trip.get("image_url") or (images_map.get(trip_id, [None])[0]),
            is_tour_package=updated_trip.get("is_tour_package"),
            suitability=updated_trip.get("suitability"),
            image_gallery=images_map.get(trip_id, []),
            member_trip_ids=updated_trip.get("member_trip_ids") or [],
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating trip {trip_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update trip: {str(e)}",
        )


# ============================================================================
# Trip Bundles (Phase 2)
# ----------------------------------------------------------------------------
# A "bundle anchor" is a normal trips row with member_trip_ids populated.
# Bookings on the anchor fan out to every member trip (see bookings.py).
# All validation rules live in `_validate_bundle_chain`.
# ============================================================================


class CreateBundleRequest(BaseModel):
    member_trip_ids: List[int] = Field(
        ..., min_length=2, description="Ordered trip_ids that make up the tour, leg 1 first"
    )


class UpdateBundleRequest(BaseModel):
    member_trip_ids: List[int] = Field(..., min_length=2)


def _row_to_trip_response(
    trip_data: dict,
    images_map: dict,
    agent_name: Optional[str] = None,
) -> TripResponse:
    return TripResponse(
        trip_id=trip_data["trip_id"],
        agent_id=trip_data["agent_id"],
        origin_city=trip_data["origin_city"],
        destination_province=trip_data["destination_province"],
        destination_city=trip_data["destination_city"],
        departure_time=datetime.fromisoformat(trip_data["departure_time"].replace("Z", "+00:00")),
        arrival_time=datetime.fromisoformat(trip_data["arrival_time"].replace("Z", "+00:00")),
        price=Decimal(str(trip_data["price"])),
        transport_type=trip_data["transport_type"],
        total_seats=trip_data["total_seats"],
        available_seats=trip_data["available_seats"],
        created_at=datetime.fromisoformat(trip_data["created_at"].replace("Z", "+00:00")),
        agent_name=agent_name,
        image_url=trip_data.get("image_url")
        or (images_map.get(trip_data["trip_id"], [None])[0]),
        is_tour_package=trip_data.get("is_tour_package"),
        suitability=trip_data.get("suitability"),
        image_gallery=images_map.get(trip_data["trip_id"], []),
        member_trip_ids=trip_data.get("member_trip_ids") or [],
    )


def _validate_bundle_chain(legs: List[dict], current_agent_id: int) -> None:
    """
    Enforce the 7 chain validation rules from trip-bundles-plan.mdc.

    Raises HTTPException on failure. Caller is responsible for ordering `legs`
    to match the requested member_trip_ids order.
    """
    if len(legs) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A bundle must contain at least 2 trips.",
        )

    # Rule 2: ownership
    for leg in legs:
        if leg.get("agent_id") != current_agent_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Trip {leg.get('trip_id')} does not belong to you.",
            )

    # Rule 7: no nested bundles
    for leg in legs:
        if leg.get("member_trip_ids"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Trip {leg['trip_id']} is itself a bundle anchor; nesting is not allowed.",
            )

    # Rule 6: every leg has at least one available seat
    for leg in legs:
        if (leg.get("available_seats") or 0) <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Trip {leg['trip_id']} has no available seats.",
            )

    seen_edges: set[tuple[str, str]] = set()
    for i, leg in enumerate(legs):
        origin = (leg.get("origin_city") or "").strip()
        dest = (leg.get("destination_city") or "").strip()
        edge = (origin.lower(), dest.lower())

        # Rule 4: directed-edge uniqueness
        if edge in seen_edges:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate route {origin} → {dest} in the bundle.",
            )
        seen_edges.add(edge)

        if i == 0:
            continue

        prev = legs[i - 1]
        prev_dest = (prev.get("destination_city") or "").strip().lower()

        # Rule 3: continuity (destination of leg i-1 == origin of leg i)
        if prev_dest != origin.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Chain breaks at leg {i + 1}: previous leg ended in "
                    f"{prev.get('destination_city')} but this leg starts in {origin}."
                ),
            )

        # Rule 5: temporal feasibility (no time travel)
        prev_arrival = datetime.fromisoformat(
            prev["arrival_time"].replace("Z", "+00:00")
        )
        this_departure = datetime.fromisoformat(
            leg["departure_time"].replace("Z", "+00:00")
        )
        if this_departure < prev_arrival:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Leg {i + 1} departs before leg {i} arrives "
                    f"({this_departure.isoformat()} < {prev_arrival.isoformat()})."
                ),
            )


def _load_ordered_member_trips(
    supabase, member_trip_ids: List[int]
) -> List[dict]:
    """Fetch trips by ids and return them ordered to match member_trip_ids."""
    if not member_trip_ids:
        return []
    result = (
        supabase.table("trips").select("*").in_("trip_id", member_trip_ids).execute()
    )
    by_id = {row["trip_id"]: row for row in (result.data or [])}
    missing = [tid for tid in member_trip_ids if tid not in by_id]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip(s) not found: {missing}",
        )
    return [by_id[tid] for tid in member_trip_ids]


def _resolve_current_agent_id(supabase, user_id: str) -> int:
    agent_result = (
        supabase.table("travel_agent").select("agent_id").eq("user_id", user_id).execute()
    )
    if not agent_result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a registered travel agent.",
        )
    return agent_result.data[0]["agent_id"]


def _anchor_has_active_bookings(supabase, anchor_id: int) -> bool:
    result = (
        supabase.table("booking")
        .select("booking_id", count="exact")
        .eq("trip_id", anchor_id)
        .neq("status", "cancelled")
        .limit(1)
        .execute()
    )
    return bool(getattr(result, "count", 0))


def _build_anchor_insert_row(
    *,
    agent_id: int,
    legs: List[dict],
    member_trip_ids: List[int],
) -> dict:
    """Aggregate member fields into the anchor row payload."""
    total_price = sum(Decimal(str(leg["price"])) for leg in legs)
    total_seats = min(int(leg["total_seats"]) for leg in legs)
    available_seats = min(int(leg["available_seats"]) for leg in legs)
    first, last = legs[0], legs[-1]
    transport_type = first.get("transport_type") or "tour"
    suitability = first.get("suitability") or "Solo Travelers"
    return {
        "agent_id": agent_id,
        "origin_city": first["origin_city"],
        "destination_province": last["destination_province"],
        "destination_city": last["destination_city"],
        "departure_time": first["departure_time"],
        "arrival_time": last["arrival_time"],
        "price": float(total_price),
        "transport_type": transport_type,
        "total_seats": total_seats,
        "available_seats": available_seats,
        "suitability": suitability,
        "member_trip_ids": member_trip_ids,
        "is_tour_package": True,
    }


@router.post("/bundle", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
async def create_trip_bundle(
    payload: CreateBundleRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Create a new trip bundle (multi-leg Tour Package) anchored on a fresh
    `trips` row. The anchor's fields are aggregated from the listed members.

    See `.cursor/rules/trip-bundles-plan.mdc` for the locked design decisions.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]
    agent_id = _resolve_current_agent_id(supabase, user_id)

    legs = _load_ordered_member_trips(supabase, payload.member_trip_ids)
    _validate_bundle_chain(legs, agent_id)

    insert_row = _build_anchor_insert_row(
        agent_id=agent_id,
        legs=legs,
        member_trip_ids=payload.member_trip_ids,
    )

    try:
        result = supabase.table("trips").insert(insert_row).execute()
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create bundle anchor.",
            )
        created = result.data[0]
        images_map = _fetch_trip_images_map(supabase, [created["trip_id"]])
        return _row_to_trip_response(created, images_map)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating bundle: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create bundle: {str(e)}",
        )


@router.patch("/bundle/{anchor_id}", response_model=TripResponse)
async def update_trip_bundle(
    anchor_id: int,
    payload: UpdateBundleRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Replace the member list of an existing bundle anchor.
    Allowed only while the anchor has no non-cancelled bookings (decision 8).
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]
    agent_id = _resolve_current_agent_id(supabase, user_id)

    anchor_result = supabase.table("trips").select("*").eq("trip_id", anchor_id).execute()
    if not anchor_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bundle anchor not found.",
        )
    anchor = anchor_result.data[0]
    if anchor.get("agent_id") != agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the bundle owner can edit it.",
        )
    if not anchor.get("member_trip_ids"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trip is not a bundle anchor.",
        )
    if _anchor_has_active_bookings(supabase, anchor_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bundle has confirmed bookings and can no longer be edited.",
        )
    if anchor_id in payload.member_trip_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A bundle cannot include itself.",
        )

    legs = _load_ordered_member_trips(supabase, payload.member_trip_ids)
    _validate_bundle_chain(legs, agent_id)

    update_row = _build_anchor_insert_row(
        agent_id=agent_id,
        legs=legs,
        member_trip_ids=payload.member_trip_ids,
    )
    # Drop agent_id from the update payload (immutable)
    update_row.pop("agent_id", None)

    try:
        result = (
            supabase.table("trips").update(update_row).eq("trip_id", anchor_id).execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update bundle.",
            )
        updated = result.data[0]
        images_map = _fetch_trip_images_map(supabase, [anchor_id])
        return _row_to_trip_response(updated, images_map)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating bundle {anchor_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update bundle: {str(e)}",
        )


@router.get("/{trip_id}/legs", response_model=List[TripResponse])
async def get_bundle_legs(trip_id: int):
    """
    Return the ordered member trips of a bundle anchor.
    Returns an empty list for ordinary (non-bundle) trips.
    Negative trip_id (external/partner trips) always returns an empty list.
    """
    if trip_id < 0:
        return []

    supabase = get_supabase_client()
    anchor_result = (
        supabase.table("trips")
        .select("trip_id, member_trip_ids")
        .eq("trip_id", trip_id)
        .execute()
    )
    if not anchor_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found",
        )
    member_ids = anchor_result.data[0].get("member_trip_ids") or []
    if not member_ids:
        return []

    legs = _load_ordered_member_trips(supabase, member_ids)
    agent_ids = list({leg["agent_id"] for leg in legs})
    agent_names: dict[int, Optional[str]] = {}
    if agent_ids:
        agents_result = (
            supabase.table("travel_agent")
            .select("agent_id, name")
            .in_("agent_id", agent_ids)
            .execute()
        )
        for row in agents_result.data or []:
            agent_names[row["agent_id"]] = row.get("name")
    images_map = _fetch_trip_images_map(supabase, [leg["trip_id"] for leg in legs])
    return [
        _row_to_trip_response(leg, images_map, agent_names.get(leg["agent_id"]))
        for leg in legs
    ]

