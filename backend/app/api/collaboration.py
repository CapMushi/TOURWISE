from datetime import datetime, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from decimal import Decimal

from app.core.security import get_current_user
from app.services.supabase_client import get_supabase_client


router = APIRouter()


# Request/Response Models
class AgentInfo(BaseModel):
    agent_id: int
    user_id: str
    agent_name: Optional[str] = None
    rating: Optional[Decimal] = None
    numberofreviews: Optional[int] = None
    verification_status: Optional[str] = None


class TripWithAgent(BaseModel):
    trip_id: int
    agent_id: int
    agent_name: Optional[str] = None
    origin_city: str
    destination_province: str
    destination_city: str
    departure_time: datetime
    arrival_time: datetime
    price: Decimal
    transport_type: str
    total_seats: int
    available_seats: int
    suitability: Optional[str] = None
    image_url: Optional[str] = None
    is_tour_package: Optional[bool] = None


class MatchingTrip(BaseModel):
    trip: TripWithAgent
    my_trip: TripWithAgent
    match_score: float = Field(..., description="Match quality score (0-1)")


class BusPoolingRequestCreate(BaseModel):
    target_trip_id: int = Field(..., description="The trip ID to pool with")
    requester_trip_id: int = Field(..., description="Your trip ID")
    message: Optional[str] = Field(None, description="Optional message to the target agent")
    seat_management: str = Field(..., description="'combined' or 'separate'")
    selected_bus_agent_id: int = Field(..., description="Which agent's bus to use (requester or target)")


class BusPoolingRequestResponse(BaseModel):
    request_id: int
    requester_agent_id: int
    requester_agent_name: Optional[str] = None
    target_agent_id: int
    target_agent_name: Optional[str] = None
    requester_trip: TripWithAgent
    target_trip: TripWithAgent
    status: str
    message: Optional[str] = None
    seat_management: Optional[str] = None
    selected_bus_agent_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class BusPoolingRequestUpdate(BaseModel):
    status: str = Field(..., description="'approved', 'rejected', or 'cancelled'")
    selected_bus_agent_id: Optional[int] = Field(None, description="Which agent's bus to use (required if approving)")


class AgentMessageCreate(BaseModel):
    receiver_agent_id: int = Field(..., description="Agent to send message to")
    subject: Optional[str] = Field(None, description="Message subject")
    content: str = Field(..., min_length=1, description="Message content")
    related_pooling_request_id: Optional[int] = Field(None, description="Related pooling request ID")


class AgentMessageResponse(BaseModel):
    message_id: int
    sender_agent_id: int
    sender_agent_name: Optional[str] = None
    receiver_agent_id: int
    receiver_agent_name: Optional[str] = None
    subject: Optional[str] = None
    content: str
    related_pooling_request_id: Optional[int] = None
    is_read: bool
    created_at: datetime


def compute_match_score(trip1: dict, trip2: dict) -> Optional[float]:
    """
    Compute a match quality score (0.0–1.0) for bus-pooling eligibility.

    Matching requires same origin AND same destination city (case-insensitive).
    That baseline gives 0.30.  Additional criteria add further points:

    +0.30  departure times are within 2 hours of each other
    +0.20  arrival times are within 2 hours of each other
    +0.20  available seat counts are within 20 % of each other

    Returns None when the trips do not share both origin and destination
    (i.e. they are ineligible for pooling regardless of score).
    Both trips must also have at least 1 available seat.
    """
    # Require available seats
    if trip1.get("available_seats", 0) <= 0 or trip2.get("available_seats", 0) <= 0:
        return None

    # --- Mandatory: same origin city -----------------------------------------
    orig1 = (trip1.get("origin_city") or "").strip().lower()
    orig2 = (trip2.get("origin_city") or "").strip().lower()
    if not orig1 or not orig2 or orig1 != orig2:
        return None

    # --- Mandatory: same destination city ------------------------------------
    dest1 = (trip1.get("destination_city") or "").strip().lower()
    dest2 = (trip2.get("destination_city") or "").strip().lower()
    if not dest1 or not dest2 or dest1 != dest2:
        return None

    score = 0.30  # base: same origin + destination

    # --- Parse departure / arrival times -------------------------------------
    def _parse_dt(val) -> Optional[datetime]:
        if val is None:
            return None
        if isinstance(val, datetime):
            return val
        try:
            return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
        except Exception:
            return None

    dep1 = _parse_dt(trip1.get("departure_time"))
    dep2 = _parse_dt(trip2.get("departure_time"))
    arr1 = _parse_dt(trip1.get("arrival_time"))
    arr2 = _parse_dt(trip2.get("arrival_time"))

    TWO_HOURS = 2 * 3600  # seconds

    if dep1 and dep2:
        dep_diff = abs((dep1 - dep2).total_seconds())
        if dep_diff <= TWO_HOURS:
            score += 0.30

    if arr1 and arr2:
        arr_diff = abs((arr1 - arr2).total_seconds())
        if arr_diff <= TWO_HOURS:
            score += 0.20

    # --- Available seats within 20 % -----------------------------------------
    seats1 = trip1.get("available_seats", 0)
    seats2 = trip2.get("available_seats", 0)
    if seats1 > 0 and seats2 > 0:
        ratio = min(seats1, seats2) / max(seats1, seats2)
        if ratio >= 0.80:
            score += 0.20

    return round(min(score, 1.0), 2)


@router.get("/agents", response_model=List[AgentInfo])
def get_other_agents(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Get all other travel agents (excluding current agent).
    """
    try:
        # Get current agent
        agent_result = supabase.table("travel_agent").select("agent_id").eq("user_id", current_user["id"]).execute()
        
        if not agent_result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a travel agent",
            )
        
        current_agent_id = agent_result.data[0]["agent_id"]
        
        # Get all other agents
        agents_result = supabase.table("travel_agent").select(
            "agent_id, user_id, name, rating, numberofreviews, verification_status"
        ).neq("agent_id", current_agent_id).execute()
        
        # Map 'name' to 'agent_name' for the response model
        agents = []
        for agent in agents_result.data:
            agent_dict = dict(agent)
            agent_dict['agent_name'] = agent_dict.pop('name', None)
            agents.append(AgentInfo(**agent_dict))
        
        return agents
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching agents: {str(e)}",
        )


@router.get("/trips", response_model=List[TripWithAgent])
def get_other_agents_trips(
    destination_city: Optional[str] = Query(None, description="Filter by destination city"),
    origin_city: Optional[str] = Query(None, description="Filter by origin city"),
    departure_date: Optional[str] = Query(None, description="Filter by departure date (YYYY-MM-DD)"),
    suitability: Optional[str] = Query(None, description="Filter by suitability"),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Get trips from other agents with optional filters.
    """
    try:
        # Get current agent
        agent_result = supabase.table("travel_agent").select("agent_id").eq("user_id", current_user["id"]).execute()
        
        if not agent_result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a travel agent",
            )
        
        current_agent_id = agent_result.data[0]["agent_id"]
        
        # Build query for trips from other agents
        query = supabase.table("trips").select("*").neq("agent_id", current_agent_id).gt("available_seats", 0)
        
        # Apply filters
        if destination_city:
            query = query.ilike("destination_city", f"%{destination_city}%")
        if origin_city:
            query = query.ilike("origin_city", f"%{origin_city}%")
        if suitability:
            query = query.eq("suitability", suitability)
        if departure_date:
            # Filter by date (need to handle date range for the day)
            try:
                target_date = datetime.fromisoformat(departure_date).date()
                start_datetime = datetime.combine(target_date, datetime.min.time())
                end_datetime = datetime.combine(target_date, datetime.max.time())
                query = query.gte("departure_time", start_datetime.isoformat())
                query = query.lte("departure_time", end_datetime.isoformat())
            except ValueError:
                pass
        
        result = query.execute()
        
        # Get agent names for all unique agent_ids
        agent_ids = list(set([trip["agent_id"] for trip in result.data]))
        agent_names_map = {}
        if agent_ids:
            agents_result = supabase.table("travel_agent").select("agent_id, name").in_("agent_id", agent_ids).execute()
            for agent in agents_result.data:
                agent_names_map[agent["agent_id"]] = agent.get("name")
        
        # Transform response
        trips = []
        for trip in result.data:
            trips.append(TripWithAgent(
                trip_id=trip["trip_id"],
                agent_id=trip["agent_id"],
                agent_name=agent_names_map.get(trip["agent_id"]),
                origin_city=trip["origin_city"],
                destination_province=trip["destination_province"],
                destination_city=trip["destination_city"],
                departure_time=trip["departure_time"],
                arrival_time=trip["arrival_time"],
                price=trip["price"],
                transport_type=trip["transport_type"],
                total_seats=trip["total_seats"],
                available_seats=trip["available_seats"],
                suitability=trip.get("suitability"),
                image_url=trip.get("image_url"),
                is_tour_package=trip.get("is_tour_package"),
            ))
        
        return trips
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching trips: {str(e)}",
        )


@router.get("/matching-trips", response_model=List[MatchingTrip])
def get_matching_trips(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Get trips from other agents that match current agent's trips for bus pooling.
    Automatically filters by: same origin, destination, date, suitability.
    """
    try:
        # Get current agent
        agent_result = supabase.table("travel_agent").select("agent_id").eq("user_id", current_user["id"]).execute()
        
        if not agent_result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a travel agent",
            )
        
        current_agent_id = agent_result.data[0]["agent_id"]
        
        # Get current agent's trips with available seats
        my_trips_result = supabase.table("trips").select("*").eq("agent_id", current_agent_id).gt("available_seats", 0).execute()
        
        if not my_trips_result.data:
            return []
        
        # Get all other agents' trips with available seats
        other_trips_result = supabase.table("trips").select("*").neq("agent_id", current_agent_id).gt("available_seats", 0).execute()
        
        # Get agent names for all unique agent_ids
        agent_ids = list(set([trip["agent_id"] for trip in other_trips_result.data]))
        agent_names_map = {}
        if agent_ids:
            agents_result = supabase.table("travel_agent").select("agent_id, name").in_("agent_id", agent_ids).execute()
            for agent in agents_result.data:
                agent_names_map[agent["agent_id"]] = agent.get("name")
        
        # Find matches using the multi-criteria scoring function
        matches = []
        for my_trip in my_trips_result.data:
            for other_trip in other_trips_result.data:
                score = compute_match_score(my_trip, other_trip)
                if score is None:
                    continue  # ineligible (different origin or destination)

                match_trip = TripWithAgent(
                    trip_id=other_trip["trip_id"],
                    agent_id=other_trip["agent_id"],
                    agent_name=agent_names_map.get(other_trip["agent_id"]),
                    origin_city=other_trip["origin_city"],
                    destination_province=other_trip["destination_province"],
                    destination_city=other_trip["destination_city"],
                    departure_time=other_trip["departure_time"],
                    arrival_time=other_trip["arrival_time"],
                    price=other_trip["price"],
                    transport_type=other_trip["transport_type"],
                    total_seats=other_trip["total_seats"],
                    available_seats=other_trip["available_seats"],
                    suitability=other_trip.get("suitability"),
                    image_url=other_trip.get("image_url"),
                    is_tour_package=other_trip.get("is_tour_package"),
                )

                my_trip_with_agent = TripWithAgent(
                    trip_id=my_trip["trip_id"],
                    agent_id=my_trip["agent_id"],
                    agent_name=None,
                    origin_city=my_trip["origin_city"],
                    destination_province=my_trip["destination_province"],
                    destination_city=my_trip["destination_city"],
                    departure_time=my_trip["departure_time"],
                    arrival_time=my_trip["arrival_time"],
                    price=my_trip["price"],
                    transport_type=my_trip["transport_type"],
                    total_seats=my_trip["total_seats"],
                    available_seats=my_trip["available_seats"],
                    suitability=my_trip.get("suitability"),
                    image_url=my_trip.get("image_url"),
                    is_tour_package=my_trip.get("is_tour_package"),
                )

                matches.append(MatchingTrip(
                    trip=match_trip,
                    my_trip=my_trip_with_agent,
                    match_score=score,
                ))

        # Sort best matches first
        matches.sort(key=lambda m: m.match_score, reverse=True)
        return matches
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error finding matching trips: {str(e)}",
        )


@router.post("/bus-pooling/request", response_model=BusPoolingRequestResponse, status_code=status.HTTP_201_CREATED)
def create_bus_pooling_request(
    request_data: BusPoolingRequestCreate,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Create a bus pooling request.
    """
    try:
        # Get current agent
        agent_result = supabase.table("travel_agent").select("agent_id").eq("user_id", current_user["id"]).execute()
        
        if not agent_result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a travel agent",
            )
        
        requester_agent_id = agent_result.data[0]["agent_id"]
        
        # Validate requester owns the requester_trip_id
        requester_trip_result = supabase.table("trips").select("*").eq("trip_id", request_data.requester_trip_id).eq("agent_id", requester_agent_id).execute()
        
        if not requester_trip_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Requester trip not found or you don't own it",
            )
        
        requester_trip = requester_trip_result.data[0]
        
        # Get target trip and agent
        target_trip_result = (
            supabase.table("trips")
            .select("*")
            .eq("trip_id", request_data.target_trip_id)
            .execute()
        )
        
        if not target_trip_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target trip not found",
            )
        
        target_trip = target_trip_result.data[0]
        target_agent_id = target_trip["agent_id"]
        
        # Validate agents are different
        if requester_agent_id == target_agent_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot create pooling request with yourself",
            )
        
        # Validate trips match for pooling (must share same origin AND destination)
        if compute_match_score(requester_trip, target_trip) is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Trips do not match pooling criteria (must share the same origin and destination city)",
            )
        
        # Validate seat_management
        if request_data.seat_management not in ["combined", "separate"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="seat_management must be 'combined' or 'separate'",
            )
        
        # Validate selected_bus_agent_id is either requester or target
        if request_data.selected_bus_agent_id not in [requester_agent_id, target_agent_id]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="selected_bus_agent_id must be either requester or target agent",
            )
        
        # Check if request already exists
        existing = supabase.table("bus_pooling_requests").select("*").eq("requester_agent_id", requester_agent_id).eq("target_agent_id", target_agent_id).eq("requester_trip_id", request_data.requester_trip_id).eq("target_trip_id", request_data.target_trip_id).eq("status", "pending").execute()
        
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A pending pooling request already exists for these trips",
            )
        
        # Create request
        insert_data = {
            "requester_agent_id": requester_agent_id,
            "target_agent_id": target_agent_id,
            "requester_trip_id": request_data.requester_trip_id,
            "target_trip_id": request_data.target_trip_id,
            "status": "pending",
            "message": request_data.message,
            "seat_management": request_data.seat_management,
            "selected_bus_agent_id": request_data.selected_bus_agent_id,
        }
        
        result = supabase.table("bus_pooling_requests").insert(insert_data).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create pooling request",
            )
        
        created_request = result.data[0]
        
        # Get agent names
        requester_agent_info = supabase.table("travel_agent").select("name").eq("agent_id", requester_agent_id).execute()
        target_agent_info = supabase.table("travel_agent").select("name").eq("agent_id", target_agent_id).execute()
        
        # Build response
        agent_info = target_trip.get("travel_agent", {})
        return BusPoolingRequestResponse(
            request_id=created_request["request_id"],
            requester_agent_id=requester_agent_id,
            requester_agent_name=requester_agent_info.data[0].get("name") if requester_agent_info.data else None,
            target_agent_id=target_agent_id,
            target_agent_name=target_agent_info.data[0].get("name") if target_agent_info.data else None,
                requester_trip=TripWithAgent(
                    trip_id=requester_trip["trip_id"],
                    agent_id=requester_trip["agent_id"],
                    agent_name=requester_agent_info.data[0].get("name") if requester_agent_info.data else None,
                origin_city=requester_trip["origin_city"],
                destination_province=requester_trip["destination_province"],
                destination_city=requester_trip["destination_city"],
                departure_time=requester_trip["departure_time"],
                arrival_time=requester_trip["arrival_time"],
                price=requester_trip["price"],
                transport_type=requester_trip["transport_type"],
                total_seats=requester_trip["total_seats"],
                available_seats=requester_trip["available_seats"],
                suitability=requester_trip.get("suitability"),
                image_url=requester_trip.get("image_url"),
                is_tour_package=requester_trip.get("is_tour_package"),
            ),
            target_trip=TripWithAgent(
                trip_id=target_trip["trip_id"],
                agent_id=target_trip["agent_id"],
                agent_name=target_agent_info.data[0].get("name") if target_agent_info.data else None,
                origin_city=target_trip["origin_city"],
                destination_province=target_trip["destination_province"],
                destination_city=target_trip["destination_city"],
                departure_time=target_trip["departure_time"],
                arrival_time=target_trip["arrival_time"],
                price=target_trip["price"],
                transport_type=target_trip["transport_type"],
                total_seats=target_trip["total_seats"],
                available_seats=target_trip["available_seats"],
                suitability=target_trip.get("suitability"),
                image_url=target_trip.get("image_url"),
                is_tour_package=target_trip.get("is_tour_package"),
            ),
            status=created_request["status"],
            message=created_request.get("message"),
            seat_management=created_request.get("seat_management"),
            selected_bus_agent_id=created_request.get("selected_bus_agent_id"),
            created_at=created_request["created_at"],
            updated_at=created_request.get("updated_at", created_request["created_at"]),
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating pooling request: {str(e)}",
        )


@router.get("/bus-pooling/requests", response_model=List[BusPoolingRequestResponse])
def get_bus_pooling_requests(
    type: str = Query("all", description="Filter: 'sent', 'received', or 'all'"),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Get bus pooling requests (sent, received, or all).
    """
    try:
        # Get current agent
        agent_result = supabase.table("travel_agent").select("agent_id").eq("user_id", current_user["id"]).execute()
        
        if not agent_result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a travel agent",
            )
        
        current_agent_id = agent_result.data[0]["agent_id"]
        
        # Build query
        query = supabase.table("bus_pooling_requests").select("*")
        
        if type == "sent":
            query = query.eq("requester_agent_id", current_agent_id)
        elif type == "received":
            query = query.eq("target_agent_id", current_agent_id)
        else:  # all
            # Use or_ with proper syntax
            query = query.or_(f"requester_agent_id.eq.{current_agent_id},target_agent_id.eq.{current_agent_id}")
        
        result = query.order("created_at", desc=True).execute()
        
        # Fetch related data
        requests = []
        for req in result.data:
            # Get trips
            requester_trip_result = supabase.table("trips").select("*").eq("trip_id", req["requester_trip_id"]).execute()
            target_trip_result = supabase.table("trips").select("*").eq("trip_id", req["target_trip_id"]).execute()
            
            requester_trip = requester_trip_result.data[0] if requester_trip_result.data else {}
            target_trip = target_trip_result.data[0] if target_trip_result.data else {}
            
            # Get agent names
            requester_agent_result = supabase.table("travel_agent").select("name").eq("agent_id", req["requester_agent_id"]).execute()
            target_agent_result = supabase.table("travel_agent").select("name").eq("agent_id", req["target_agent_id"]).execute()
            
            requester_agent = requester_agent_result.data[0] if requester_agent_result.data else {}
            target_agent = target_agent_result.data[0] if target_agent_result.data else {}
            
            requests.append(BusPoolingRequestResponse(
                request_id=req["request_id"],
                requester_agent_id=req["requester_agent_id"],
                requester_agent_name=requester_agent.get("name") if requester_agent else None,
                target_agent_id=req["target_agent_id"],
                target_agent_name=target_agent.get("name") if target_agent else None,
                requester_trip=TripWithAgent(
                    trip_id=requester_trip["trip_id"],
                    agent_id=requester_trip["agent_id"],
                    agent_name=requester_agent.get("name") if requester_agent else None,
                    origin_city=requester_trip["origin_city"],
                    destination_province=requester_trip["destination_province"],
                    destination_city=requester_trip["destination_city"],
                    departure_time=requester_trip["departure_time"],
                    arrival_time=requester_trip["arrival_time"],
                    price=requester_trip["price"],
                    transport_type=requester_trip["transport_type"],
                    total_seats=requester_trip["total_seats"],
                    available_seats=requester_trip["available_seats"],
                    suitability=requester_trip.get("suitability"),
                    image_url=requester_trip.get("image_url"),
                    is_tour_package=requester_trip.get("is_tour_package"),
                ),
                target_trip=TripWithAgent(
                    trip_id=target_trip["trip_id"],
                    agent_id=target_trip["agent_id"],
                    agent_name=target_agent.get("name") if target_agent else None,
                    origin_city=target_trip["origin_city"],
                    destination_province=target_trip["destination_province"],
                    destination_city=target_trip["destination_city"],
                    departure_time=target_trip["departure_time"],
                    arrival_time=target_trip["arrival_time"],
                    price=target_trip["price"],
                    transport_type=target_trip["transport_type"],
                    total_seats=target_trip["total_seats"],
                    available_seats=target_trip["available_seats"],
                    suitability=target_trip.get("suitability"),
                    image_url=target_trip.get("image_url"),
                    is_tour_package=target_trip.get("is_tour_package"),
                ),
                status=req["status"],
                message=req.get("message"),
                seat_management=req.get("seat_management"),
                selected_bus_agent_id=req.get("selected_bus_agent_id"),
                created_at=req["created_at"],
                updated_at=req.get("updated_at", req["created_at"]),
            ))
        
        return requests
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching pooling requests: {str(e)}",
        )


@router.patch("/bus-pooling/requests/{request_id}", response_model=BusPoolingRequestResponse)
def update_bus_pooling_request(
    request_id: int,
    update_data: BusPoolingRequestUpdate,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Update bus pooling request status (approve/reject/cancel).
    Only the target agent can approve/reject, requester can cancel.
    """
    try:
        # Get current agent
        agent_result = supabase.table("travel_agent").select("agent_id").eq("user_id", current_user["id"]).execute()
        
        if not agent_result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a travel agent",
            )
        
        current_agent_id = agent_result.data[0]["agent_id"]
        
        # Get request
        request_result = supabase.table("bus_pooling_requests").select("*").eq("request_id", request_id).execute()
        
        if not request_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pooling request not found",
            )
        
        request_data = request_result.data[0]
        
        # Validate status
        valid_statuses = ["approved", "rejected", "cancelled"]
        if update_data.status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Status must be one of: {', '.join(valid_statuses)}",
            )
        
        # Authorization checks
        if update_data.status == "cancelled":
            # Only requester can cancel
            if current_agent_id != request_data["requester_agent_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the requester can cancel a pooling request",
                )
        else:  # approved or rejected
            # Only target agent can approve/reject
            if current_agent_id != request_data["target_agent_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the target agent can approve or reject a pooling request",
                )
            
            # If approving, selected_bus_agent_id is required
            if update_data.status == "approved" and not update_data.selected_bus_agent_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="selected_bus_agent_id is required when approving",
                )
            
            # Validate selected_bus_agent_id is either requester or target
            if update_data.selected_bus_agent_id not in [request_data["requester_agent_id"], request_data["target_agent_id"]]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="selected_bus_agent_id must be either requester or target agent",
                )
        
        # Update request
        update_payload = {
            "status": update_data.status,
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        if update_data.selected_bus_agent_id:
            update_payload["selected_bus_agent_id"] = update_data.selected_bus_agent_id
        
        result = supabase.table("bus_pooling_requests").update(update_payload).eq("request_id", request_id).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update pooling request",
            )
        
        updated_request = result.data[0]
        
        # Get trips and agents for response
        requester_trip_result = supabase.table("trips").select("*").eq("trip_id", updated_request["requester_trip_id"]).execute()
        target_trip_result = supabase.table("trips").select("*").eq("trip_id", updated_request["target_trip_id"]).execute()
        requester_agent_result = supabase.table("travel_agent").select("name").eq("agent_id", updated_request["requester_agent_id"]).execute()
        target_agent_result = supabase.table("travel_agent").select("name").eq("agent_id", updated_request["target_agent_id"]).execute()
        
        requester_trip = requester_trip_result.data[0]
        target_trip = target_trip_result.data[0]
        requester_agent_name = requester_agent_result.data[0].get("name") if requester_agent_result.data else None
        target_agent_name = target_agent_result.data[0].get("name") if target_agent_result.data else None
        
        return BusPoolingRequestResponse(
            request_id=updated_request["request_id"],
            requester_agent_id=updated_request["requester_agent_id"],
            requester_agent_name=requester_agent_name,
            target_agent_id=updated_request["target_agent_id"],
            target_agent_name=target_agent_name,
            requester_trip=TripWithAgent(
                trip_id=requester_trip["trip_id"],
                agent_id=requester_trip["agent_id"],
                agent_name=requester_agent_name,
                origin_city=requester_trip["origin_city"],
                destination_province=requester_trip["destination_province"],
                destination_city=requester_trip["destination_city"],
                departure_time=requester_trip["departure_time"],
                arrival_time=requester_trip["arrival_time"],
                price=requester_trip["price"],
                transport_type=requester_trip["transport_type"],
                total_seats=requester_trip["total_seats"],
                available_seats=requester_trip["available_seats"],
                suitability=requester_trip.get("suitability"),
                image_url=requester_trip.get("image_url"),
                is_tour_package=requester_trip.get("is_tour_package"),
            ),
            target_trip=TripWithAgent(
                trip_id=target_trip["trip_id"],
                agent_id=target_trip["agent_id"],
                agent_name=target_agent_name,
                origin_city=target_trip["origin_city"],
                destination_province=target_trip["destination_province"],
                destination_city=target_trip["destination_city"],
                departure_time=target_trip["departure_time"],
                arrival_time=target_trip["arrival_time"],
                price=target_trip["price"],
                transport_type=target_trip["transport_type"],
                total_seats=target_trip["total_seats"],
                available_seats=target_trip["available_seats"],
                suitability=target_trip.get("suitability"),
                image_url=target_trip.get("image_url"),
                is_tour_package=target_trip.get("is_tour_package"),
            ),
            status=updated_request["status"],
            message=updated_request.get("message"),
            seat_management=updated_request.get("seat_management"),
            selected_bus_agent_id=updated_request.get("selected_bus_agent_id"),
            created_at=updated_request["created_at"],
            updated_at=updated_request.get("updated_at", updated_request["created_at"]),
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating pooling request: {str(e)}",
        )


@router.get("/messages", response_model=List[AgentMessageResponse])
def get_messages(
    agent_id: Optional[int] = Query(None, description="Filter by specific agent (conversation)"),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Get messages between agents. If agent_id is provided, returns conversation with that agent.
    """
    try:
        # Get current agent
        agent_result = supabase.table("travel_agent").select("agent_id").eq("user_id", current_user["id"]).execute()
        
        if not agent_result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a travel agent",
            )
        
        current_agent_id = agent_result.data[0]["agent_id"]
        
        # Build query
        query = supabase.table("agent_messages").select("*")
        
        if agent_id:
            # Get conversation with specific agent - messages where current agent is sender or receiver AND other agent is sender or receiver
            query = query.or_(f"sender_agent_id.eq.{current_agent_id},receiver_agent_id.eq.{current_agent_id}")
            # Filter to only messages involving the selected agent
            result = query.execute()
            # Filter in Python to ensure both agents are involved
            filtered_messages = [
                msg for msg in result.data
                if (msg["sender_agent_id"] == current_agent_id and msg["receiver_agent_id"] == agent_id) or
                   (msg["receiver_agent_id"] == current_agent_id and msg["sender_agent_id"] == agent_id)
            ]
        else:
            # Get all messages where current agent is sender or receiver
            query = query.or_(f"sender_agent_id.eq.{current_agent_id},receiver_agent_id.eq.{current_agent_id}")
            result = query.execute()
            filtered_messages = result.data
        
        # Sort by created_at ascending
        filtered_messages.sort(key=lambda x: x["created_at"])
        
        # Fetch agent names
        messages = []
        for msg in filtered_messages:
            sender_agent_result = supabase.table("travel_agent").select("name").eq("agent_id", msg["sender_agent_id"]).execute()
            receiver_agent_result = supabase.table("travel_agent").select("name").eq("agent_id", msg["receiver_agent_id"]).execute()
            
            sender_agent = sender_agent_result.data[0] if sender_agent_result.data else {}
            receiver_agent = receiver_agent_result.data[0] if receiver_agent_result.data else {}
            
            messages.append(AgentMessageResponse(
                message_id=msg["message_id"],
                sender_agent_id=msg["sender_agent_id"],
                sender_agent_name=sender_agent.get("name") if sender_agent else None,
                receiver_agent_id=msg["receiver_agent_id"],
                receiver_agent_name=receiver_agent.get("name") if receiver_agent else None,
                subject=msg.get("subject"),
                content=msg["content"],
                related_pooling_request_id=msg.get("related_pooling_request_id"),
                is_read=msg.get("is_read", False),
                created_at=msg["created_at"],
            ))
        
        return messages
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching messages: {str(e)}",
        )


@router.post("/messages", response_model=AgentMessageResponse, status_code=status.HTTP_201_CREATED)
def create_message(
    message_data: AgentMessageCreate,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Send a message to another agent.
    """
    try:
        # Get current agent
        agent_result = supabase.table("travel_agent").select("agent_id").eq("user_id", current_user["id"]).execute()
        
        if not agent_result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a travel agent",
            )
        
        sender_agent_id = agent_result.data[0]["agent_id"]
        
        # Validate receiver exists and is different
        if sender_agent_id == message_data.receiver_agent_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot send message to yourself",
            )
        
        receiver_result = supabase.table("travel_agent").select("agent_id").eq("agent_id", message_data.receiver_agent_id).execute()
        
        if not receiver_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Receiver agent not found",
            )
        
        # Create message
        insert_data = {
            "sender_agent_id": sender_agent_id,
            "receiver_agent_id": message_data.receiver_agent_id,
            "subject": message_data.subject,
            "content": message_data.content,
            "related_pooling_request_id": message_data.related_pooling_request_id,
            "is_read": False,
        }
        
        result = supabase.table("agent_messages").insert(insert_data).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create message",
            )
        
        created_message = result.data[0]
        
        # Get agent names
        sender_agent_info = supabase.table("travel_agent").select("name").eq("agent_id", sender_agent_id).execute()
        receiver_agent_info = supabase.table("travel_agent").select("name").eq("agent_id", message_data.receiver_agent_id).execute()
        
        return AgentMessageResponse(
            message_id=created_message["message_id"],
            sender_agent_id=sender_agent_id,
            sender_agent_name=sender_agent_info.data[0].get("name") if sender_agent_info.data else None,
            receiver_agent_id=message_data.receiver_agent_id,
            receiver_agent_name=receiver_agent_info.data[0].get("name") if receiver_agent_info.data else None,
            subject=created_message.get("subject"),
            content=created_message["content"],
            related_pooling_request_id=created_message.get("related_pooling_request_id"),
            is_read=created_message.get("is_read", False),
            created_at=created_message["created_at"],
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating message: {str(e)}",
        )


@router.get("/messages/unread-count")
def get_unread_message_count(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Get count of unread messages for current agent.
    """
    try:
        # Get current agent
        agent_result = supabase.table("travel_agent").select("agent_id").eq("user_id", current_user["id"]).execute()
        
        if not agent_result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a travel agent",
            )
        
        current_agent_id = agent_result.data[0]["agent_id"]
        
        # Count unread messages
        result = supabase.table("agent_messages").select("message_id", count="exact").eq("receiver_agent_id", current_agent_id).eq("is_read", False).execute()
        
        count = result.count if hasattr(result, 'count') else len(result.data) if result.data else 0
        
        return {"count": count}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching unread count: {str(e)}",
        )


@router.patch("/messages/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_conversation_messages_read(
    other_agent_id: int = Query(..., description="Mark messages from this agent as read"),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """Mark all messages received from other_agent_id as read for the current agent."""
    try:
        agent_result = supabase.table("travel_agent").select("agent_id").eq("user_id", current_user["id"]).execute()
        if not agent_result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a travel agent",
            )
        current_agent_id = agent_result.data[0]["agent_id"]
        supabase.table("agent_messages").update({"is_read": True}).eq(
            "receiver_agent_id", current_agent_id
        ).eq("sender_agent_id", other_agent_id).execute()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error marking messages read: {str(e)}",
        )


class AgentNotificationFeedItem(BaseModel):
    notification_id: str
    category: str
    title: str
    body: str
    created_at: datetime


@router.get("/agent-notification-feed", response_model=List[AgentNotificationFeedItem])
def get_agent_notification_feed(
    limit: int = Query(30, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """Unified notifications: pending pooling requests, recent bookings on agent trips, unread messages summary."""
    try:
        agent_result = supabase.table("travel_agent").select("agent_id, name").eq("user_id", current_user["id"]).execute()
        if not agent_result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a travel agent",
            )
        agent_id = agent_result.data[0]["agent_id"]
        agent_name = agent_result.data[0].get("name") or "Agent"

        items: List[dict] = []

        pooling_res = (
            supabase.table("bus_pooling_requests")
            .select("*")
            .eq("target_agent_id", agent_id)
            .eq("status", "pending")
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        for req in pooling_res.data or []:
            ra = supabase.table("travel_agent").select("name").eq("agent_id", req["requester_agent_id"]).execute()
            req_name = ra.data[0].get("name") if ra.data else f"Agent #{req['requester_agent_id']}"
            trip_res = supabase.table("trips").select("origin_city, destination_city").eq("trip_id", req["target_trip_id"]).execute()
            trip = trip_res.data[0] if trip_res.data else {}
            oc = trip.get("origin_city", "")
            dc = trip.get("destination_city", "")
            items.append({
                "notification_id": f"pool-{req['request_id']}",
                "category": "pooling",
                "title": "Bus pooling request",
                "body": f"{req_name} wants to pool buses for {oc} → {dc}. Review in Collaboration Hub.",
                "created_at": req["created_at"],
            })

        trips_res = supabase.table("trips").select("trip_id").eq("agent_id", agent_id).execute()
        trip_ids = [t["trip_id"] for t in (trips_res.data or [])]
        if trip_ids:
            bookings_res = (
                supabase.table("booking")
                .select("*")
                .in_("trip_id", trip_ids)
                .order("booking_date", desc=True)
                .limit(20)
                .execute()
            )
            for b in bookings_res.data or []:
                tr = supabase.table("trips").select("origin_city, destination_city").eq("trip_id", b["trip_id"]).execute()
                trow = tr.data[0] if tr.data else {}
                ref = b.get("booking_reference", "")
                status_txt = b.get("status", "")
                items.append({
                    "notification_id": f"book-{b['booking_id']}",
                    "category": "booking",
                    "title": f"Booking {status_txt}",
                    "body": f"{ref}: {trow.get('origin_city', '')} → {trow.get('destination_city', '')} — {b.get('number_of_seats', 0)} seat(s).",
                    "created_at": b["booking_date"],
                })

        # Collaboration invites (pending, where current agent is the collaborating agent)
        collab_res = (
            supabase.table("trip_collaborators")
            .select("*")
            .eq("collaborating_agent_id", agent_id)
            .eq("status", "pending")
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        for inv in collab_res.data or []:
            inv_agent = supabase.table("travel_agent").select("name").eq("agent_id", inv["inviting_agent_id"]).execute()
            inv_name = inv_agent.data[0].get("name") if inv_agent.data else f"Agent #{inv['inviting_agent_id']}"
            trip_r = supabase.table("trips").select("origin_city, destination_city").eq("trip_id", inv["trip_id"]).execute()
            t = trip_r.data[0] if trip_r.data else {}
            items.append({
                "notification_id": f"collab-{inv['invite_id']}",
                "category": "collaboration",
                "title": "Collaboration invite",
                "body": f"{inv_name} invited you to collaborate on {t.get('origin_city', '')} → {t.get('destination_city', '')}. Review in Collaboration Hub.",
                "created_at": inv["created_at"],
            })

        unread_cnt_res = (
            supabase.table("agent_messages")
            .select("message_id", count="exact")
            .eq("receiver_agent_id", agent_id)
            .eq("is_read", False)
            .execute()
        )
        unread_n = getattr(unread_cnt_res, "count", None)
        if unread_n is None:
            unread_n = len(unread_cnt_res.data) if unread_cnt_res.data else 0
        latest_unread_ts = None
        if unread_n > 0:
            latest_row = (
                supabase.table("agent_messages")
                .select("created_at")
                .eq("receiver_agent_id", agent_id)
                .eq("is_read", False)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if latest_row.data:
                latest_unread_ts = latest_row.data[0].get("created_at")
            ts = latest_unread_ts or datetime.utcnow().isoformat()
            items.append({
                "notification_id": "msg-unread-summary",
                "category": "message",
                "title": "Unread agent messages",
                "body": f"You have {unread_n} unread message(s). Open Collaboration Hub → Messages.",
                "created_at": ts,
            })

        def parse_ts(x):
            v = x["created_at"]
            if isinstance(v, datetime):
                return v
            if isinstance(v, str):
                return datetime.fromisoformat(v.replace("Z", "+00:00"))
            return datetime.min

        items.sort(key=parse_ts, reverse=True)
        items = items[:limit]

        out: List[AgentNotificationFeedItem] = []
        for x in items:
            ca = x["created_at"]
            if isinstance(ca, str):
                ca = datetime.fromisoformat(ca.replace("Z", "+00:00"))
            out.append(
                AgentNotificationFeedItem(
                    notification_id=x["notification_id"],
                    category=x["category"],
                    title=x["title"],
                    body=x["body"],
                    created_at=ca,
                )
            )
        return out

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error building notification feed: {str(e)}",
        )


