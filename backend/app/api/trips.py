from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field, field_validator, model_validator
from decimal import Decimal

from app.core.security import get_current_user
from app.services.supabase_client import get_supabase_client


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

    class Config:
        from_attributes = True


class TripListResponse(BaseModel):
    trips: List[TripResponse]
    total: int


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
):
    """
    Get all available trips with optional filters for search functionality.
    Only returns trips with available_seats > 0 when filters are provided.
    If no filters are provided, returns all trips ordered by trip_id.
    """
    supabase = get_supabase_client()
    
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
    
    # Only filter by available_seats if filters are provided
    # If no filters, show all trips (including those with 0 available seats)
    if has_filters:
        query = query.gt("available_seats", 0)
    
    # Apply filters
    if destination_province:
        query = query.ilike("destination_province", f"%{destination_province}%")
    if destination_city:
        query = query.ilike("destination_city", f"%{destination_city}%")
    if origin_city:
        query = query.ilike("origin_city", f"%{origin_city}%")
    if transport_type and transport_type.lower() != "any":
        query = query.eq("transport_type", transport_type.lower())
    if price_min is not None:
        query = query.gte("price", price_min)
    if price_max is not None:
        query = query.lte("price", price_max)
    if departure_date_from:
        query = query.gte("departure_time", departure_date_from.isoformat())
    if departure_date_to:
        query = query.lte("departure_time", departure_date_to.isoformat())
    if min_available_seats is not None:
        query = query.gte("available_seats", min_available_seats)
    if suitability and suitability.lower() != "any":
        query = query.eq("suitability", suitability)
    
    # Order by trip_id if no filters, otherwise by departure time
    if has_filters:
        query = query.order("departure_time", desc=False)
    else:
        query = query.order("trip_id", desc=False)
    
    try:
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
            )
            trips.append(trip)
        
        return TripListResponse(trips=trips, total=len(trips))
    
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
    """
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
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating trip {trip_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update trip: {str(e)}",
        )

