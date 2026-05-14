import { supabase } from "./supabaseClient";

// API Configuration - dynamically determine backend URL based on current hostname
const getApiBaseUrl = () => {
  // If VITE_API_URL is set, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Otherwise, use the same hostname as the frontend but with port 8000
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  return `${protocol}//${hostname}:8000`;
};

const API_BASE_URL = getApiBaseUrl();   

// Types for Trip API
export interface CreateTripRequest {
  origin_city: string;
  destination_province: string;
  destination_city: string;
  departure_time: string; // ISO 8601 datetime string
  arrival_time: string; // ISO 8601 datetime string
  price: number;
  transport_type: string;
  total_seats: number;
  available_seats?: number; // Optional, defaults to total_seats
  suitability?: string; // Optional, e.g., "Solo Travelers", "Families", "Couples"
}

export interface TripResponse {
  trip_id: number;
  agent_id: number;
  origin_city: string;
  destination_province: string;
  destination_city: string;
  departure_time: string;
  arrival_time: string;
  price: number;
  transport_type: string;
  total_seats: number;
  available_seats: number;
  created_at: string;
  agent_name?: string;
  image_url?: string;
  is_tour_package?: boolean;
  suitability?: string;
  image_gallery?: string[];
  /** local = Supabase trips; external = integration layer (synthetic trip_id) */
  source?: "local" | "external";
  provider_id?: string | null;
  external_ref?: string | null;
}

// API Error Response
export interface ApiError {
  detail: string;
}

// Skip Verification Response
export interface SkipVerificationResponse {
  message: string;
  agent_id: number;
}

export type AppRole = "traveler" | "agent" | "admin";

export interface CurrentUserContextResponse {
  id: string;
  email?: string | null;
  claims?: Record<string, unknown>;
  is_admin: boolean;
  is_agent: boolean;
  agent_id?: number | null;
  agent_verification_status?: string | null;
  app_role: AppRole;
}

// Register as Agent Response
export interface RegisterAsAgentResponse {
  message: string;
  agent_id: number;
}

export interface AdminDashboardActivity {
  id: string;
  text: string;
  created_at: string;
  time: string;
  activity_type: "agent_request" | "trip_created" | "booking_created";
}

export interface AdminDashboardResponse {
  stats: {
    total_users: number;
    pending_verifications: number;
    active_trips: number;
  };
  recent_activity: AdminDashboardActivity[];
}

export interface AdminManagedAgent {
  agent_id: number;
  user_id: string;
  name: string;
  email?: string | null;
  verification_status?: string | null;
  created_at?: string | null;
  rating?: number | null;
  numberofreviews: number;
  total_trips: number;
}

export interface AdminAgentDirectoryResponse {
  pending: AdminManagedAgent[];
  active: AdminManagedAgent[];
}

// Trip List Response
export interface TripListResponse {
  trips: TripResponse[];
  total: number;
  page: number;
  page_size?: number | null;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

export interface RecommendationsResponse {
  trips: TripResponse[];
  total: number;
  ai_used: boolean;
  fallback_used: boolean;
  summary?: string | null;
}

export interface ChatQueryRequest {
  message: string;
  category?: string;
}

export interface ChatSource {
  document_id?: number;
  title?: string;
  source_key?: string;
  similarity?: number;
}

export interface ChatQueryResponse {
  answer: string;
  sources: ChatSource[];
  used_context_count: number;
}

// Search filters for trips
export interface TripSearchFilters {
  destination_province?: string;
  destination_city?: string;
  origin_city?: string;
  transport_type?: string;
  price_min?: number;
  price_max?: number;
  departure_date_from?: string; // ISO 8601 datetime string
  departure_date_to?: string; // ISO 8601 datetime string
  min_available_seats?: number;
  suitability?: string;
}

export interface TripListOptions {
  page?: number;
  pageSize?: number;
  sortBy?: "recommended" | "departure-soonest" | "price-low-high" | "price-high-low" | "availability";
}

/**
 * Get the authentication token from Supabase session
 */
async function getAuthToken(): Promise<string | null> {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error("[API] Error getting session:", error);
    return null;
  }
  
  if (!session) {
    console.warn("[API] No active session found");
    return null;
  }
  
  if (!session.access_token) {
    console.warn("[API] Session exists but no access token found");
    return null;
  }
  
  console.log("[API] Session token retrieved successfully");
  return session.access_token;
}

/**
 * API client with automatic authentication header injection
 */
async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    console.log("[API] Authorization header added to request");
  } else {
    console.warn("[API] No token available - request will be unauthenticated");
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 204) {
      return {} as T;
    }

    // Handle non-JSON responses
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return {} as T;
    }

    const data = await response.json();

    if (!response.ok) {
      // Handle API error responses
      const error: ApiError = data;
      const errorMessage = error.detail || `API error: ${response.statusText}`;
      console.error(`[API] Request failed: ${response.status} ${response.statusText}`, errorMessage);
      throw new Error(errorMessage);
    }

    return data as T;
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      // Network error - backend might not be running
      throw new Error(
        `Cannot connect to backend server at ${url}. Please ensure the backend is running on ${API_BASE_URL}`
      );
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("An unexpected error occurred");
  }
}

/**
 * Create a new trip
 */
export async function createTrip(data: CreateTripRequest): Promise<TripResponse> {
  return apiClient<TripResponse>("/api/trips", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Register current user as a travel agent
 */
export async function registerAsAgent(): Promise<RegisterAsAgentResponse> {
  console.log("[API] Calling register as agent endpoint at:", `${API_BASE_URL}/api/register-as-agent`);
  return apiClient<RegisterAsAgentResponse>("/api/register-as-agent", {
    method: "POST",
  });
}

/**
 * Skip agent verification (testing only)
 */
export async function skipAgentVerification(): Promise<SkipVerificationResponse> {
  console.log("[API] Calling skip verification endpoint at:", `${API_BASE_URL}/api/skip-verification`);
  return apiClient<SkipVerificationResponse>("/api/skip-verification", {
    method: "POST",
  });
}

export async function getAdminDashboard(): Promise<AdminDashboardResponse> {
  return apiClient<AdminDashboardResponse>("/api/admin/dashboard", {
    method: "GET",
  });
}

export async function getAdminAgents(): Promise<AdminAgentDirectoryResponse> {
  return apiClient<AdminAgentDirectoryResponse>("/api/admin/agents", {
    method: "GET",
  });
}

export async function reviewAgentVerification(
  agentId: number,
  decision: "approved" | "rejected"
): Promise<{ message: string; agent_id: number; verification_status: string }> {
  return apiClient<{ message: string; agent_id: number; verification_status: string }>(
    `/api/admin/agents/${agentId}/verification`,
    {
      method: "PATCH",
      body: JSON.stringify({ decision }),
    }
  );
}

export async function getCurrentUserContext(): Promise<CurrentUserContextResponse> {
  return apiClient<CurrentUserContextResponse>("/api/me", {
    method: "GET",
  });
}

export async function getCurrentUserContextWithToken(
  token: string
): Promise<CurrentUserContextResponse> {
  const response = await fetch(`${API_BASE_URL}/api/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 204) {
    return {} as CurrentUserContextResponse;
  }

  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return {} as CurrentUserContextResponse;
  }

  const data = (await response.json()) as CurrentUserContextResponse | ApiError;
  if (!response.ok) {
    const errorMessage =
      "detail" in data && typeof data.detail === "string"
        ? data.detail
        : `API error: ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return data as CurrentUserContextResponse;
}

/**
 * Get all trips with optional search filters
 * If filters is undefined or empty, returns all trips ordered by trip_id
 */
export async function getTrips(
  filters?: TripSearchFilters,
  options?: TripListOptions
): Promise<TripListResponse> {
  const params = new URLSearchParams();

  if (filters?.destination_province) params.append("destination_province", filters.destination_province);
  if (filters?.destination_city) params.append("destination_city", filters.destination_city);
  if (filters?.origin_city) params.append("origin_city", filters.origin_city);
  if (filters?.transport_type) params.append("transport_type", filters.transport_type);
  if (filters?.price_min !== undefined) params.append("price_min", filters.price_min.toString());
  if (filters?.price_max !== undefined) params.append("price_max", filters.price_max.toString());
  if (filters?.departure_date_from) params.append("departure_date_from", filters.departure_date_from);
  if (filters?.departure_date_to) params.append("departure_date_to", filters.departure_date_to);
  if (filters?.min_available_seats !== undefined) params.append("min_available_seats", filters.min_available_seats.toString());
  if (filters?.suitability) params.append("suitability", filters.suitability);
  if (options?.sortBy) params.append("sort_by", options.sortBy);
  if (options?.page !== undefined) params.append("page", options.page.toString());
  if (options?.pageSize !== undefined) params.append("page_size", options.pageSize.toString());

  const queryString = params.toString();
  const endpoint = `/api/trips${queryString ? `?${queryString}` : ""}`;

  return apiClient<TripListResponse>(endpoint, {
    method: "GET",
  });
}

export async function getRecommendations(limit: number = 4, userQuery?: string): Promise<RecommendationsResponse> {
  const params = new URLSearchParams();
  params.append("limit", String(limit));
  if (userQuery && userQuery.trim()) {
    params.append("user_query", userQuery.trim());
  }
  return apiClient<RecommendationsResponse>(`/api/recommendations?${params.toString()}`, {
    method: "GET",
  });
}

export async function queryChatbot(
  data: ChatQueryRequest,
  topK: number = 5
): Promise<ChatQueryResponse> {
  return apiClient<ChatQueryResponse>(`/api/chat/query?top_k=${topK}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export type ChatStreamEvent =
  | { text: string }
  | { done: true; sources: ChatSource[]; used_context_count: number; used_live_context: boolean }
  | { error: string };

export async function* streamChatbot(
  message: string,
  topK: number = 5
): AsyncGenerator<ChatStreamEvent> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;

  const url = `${API_BASE_URL}/api/chat/query/stream?top_k=${topK}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`Chat stream error: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;
      try {
        yield JSON.parse(jsonStr) as ChatStreamEvent;
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

/**
 * Get trips for the authenticated agent
 */
export async function getMyTrips(): Promise<TripListResponse> {
  return apiClient<TripListResponse>("/api/trips/my-trips", {
    method: "GET",
  });
}

/**
 * Get a single trip by trip_id
 */
export async function getTripById(tripId: number): Promise<TripResponse> {
  return apiClient<TripResponse>(`/api/trips/${tripId}`, {
    method: "GET",
  });
}

export interface TripImageResponse {
  image_id: number;
  trip_id: number;
  image_url: string;
  alt_text?: string;
  sort_order: number;
  is_cover: boolean;
  created_at: string;
}

export interface CreateTripImageRequest {
  image_url: string;
  alt_text?: string;
  sort_order?: number;
  is_cover?: boolean;
}

export async function getTripImages(tripId: number): Promise<TripImageResponse[]> {
  return apiClient<TripImageResponse[]>(`/api/trips/${tripId}/images`, {
    method: "GET",
  });
}

export async function createTripImage(tripId: number, data: CreateTripImageRequest): Promise<TripImageResponse> {
  return apiClient<TripImageResponse>(`/api/trips/${tripId}/images`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update trip details
 */
export interface UpdateTripRequest {
  image_url?: string;
}

export async function updateTrip(tripId: number, data: UpdateTripRequest): Promise<TripResponse> {
  return apiClient<TripResponse>(`/api/trips/${tripId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export interface FavoriteStatusResponse {
  trip_id: number;
  is_favorited: boolean;
}

export interface FavoriteTripItem {
  favorite_id: number;
  trip_id: number;
  created_at: string;
  trip?: TripResponse;
}

export async function getMyFavorites(): Promise<FavoriteTripItem[]> {
  return apiClient<FavoriteTripItem[]>("/api/favorites", { method: "GET" });
}

export async function getFavoriteStatus(tripId: number): Promise<FavoriteStatusResponse> {
  return apiClient<FavoriteStatusResponse>(`/api/favorites/${tripId}/status`, { method: "GET" });
}

export async function addFavorite(tripId: number): Promise<FavoriteStatusResponse> {
  return apiClient<FavoriteStatusResponse>(`/api/favorites/${tripId}`, { method: "POST" });
}

export async function removeFavorite(tripId: number): Promise<FavoriteStatusResponse> {
  return apiClient<FavoriteStatusResponse>(`/api/favorites/${tripId}`, { method: "DELETE" });
}

export interface NotificationPreferences {
  user_id: string;
  booking_updates: boolean;
  payment_updates: boolean;
  trip_reminders: boolean;
  promotions: boolean;
  agent_messages: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
}

export type NotificationPreferencesUpdate = Partial<Omit<NotificationPreferences, "user_id" | "created_at" | "updated_at">>;

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return apiClient<NotificationPreferences>("/api/notification-preferences", { method: "GET" });
}

export async function updateNotificationPreferences(
  payload: NotificationPreferencesUpdate
): Promise<NotificationPreferences> {
  return apiClient<NotificationPreferences>("/api/notification-preferences", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** User profile (Supabase `profiles` + email from JWT) */
export interface UserProfile {
  id: string;
  email?: string | null;
  username?: string | null;
  preferences?: Record<string, unknown> | null;
  profile_details?: Record<string, unknown> | null;
  updated_at?: string | null;
}

export type UserProfileUpdate = Partial<
  Pick<UserProfile, "username" | "preferences" | "profile_details">
>;

export async function getUserProfile(): Promise<UserProfile> {
  return apiClient<UserProfile>("/api/profile", { method: "GET" });
}

export async function updateUserProfile(payload: UserProfileUpdate): Promise<UserProfile> {
  return apiClient<UserProfile>("/api/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** Booking-related notifications for the current traveler */
export interface BookingNotificationItem {
  notification_id: number;
  booking_id: number;
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface BookingNotificationListResponse {
  notifications: BookingNotificationItem[];
  total: number;
  unread_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

export async function getMyBookingNotifications(
  page: number = 1,
  pageSize: number = 10
): Promise<BookingNotificationListResponse> {
  return apiClient<BookingNotificationListResponse>(
    `/api/notifications?page=${page}&page_size=${pageSize}`,
    { method: "GET" }
  );
}

export async function markBookingNotificationRead(
  notificationId: number
): Promise<BookingNotificationItem> {
  return apiClient<BookingNotificationItem>(`/api/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export async function markAllBookingNotificationsRead(): Promise<void> {
  await apiClient<Record<string, never>>("/api/notifications/read-all", { method: "POST" });
}

/**
 * Get top rated travel agents
 */
export interface AgentResponse {
  agent_id: number;
  name: string;
  email: string;
  rating?: number;
  numberofreviews?: number;
}

export interface TopAgentsResponse {
  agents: AgentResponse[];
}

export async function getTopAgents(limit: number = 4): Promise<TopAgentsResponse> {
  return apiClient<TopAgentsResponse>(`/api/top-agents?limit=${limit}`, {
    method: "GET",
  });
}

// Traveler reviews for agents
export interface ReviewAgentItem {
  agent_id: number;
  name: string;
  email?: string | null;
  rating?: number | null;
  numberofreviews?: number | null;
  verification_status?: string | null;
  contact_info?: Record<string, unknown> | null;
  profile_details?: Record<string, unknown> | null;
}

export interface AgentReviewItem {
  review_id: number;
  agent_id: number;
  user_id: string;
  username?: string | null;
  rating: number;
  comment?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface UpsertAgentReviewRequest {
  rating: number;
  comment?: string;
}

export async function getReviewableAgents(): Promise<ReviewAgentItem[]> {
  return apiClient<ReviewAgentItem[]>("/api/reviews/agents", { method: "GET" });
}

export async function getAgentReviews(agentId: number): Promise<AgentReviewItem[]> {
  return apiClient<AgentReviewItem[]>(`/api/reviews/agents/${agentId}/reviews`, { method: "GET" });
}

export async function upsertAgentReview(
  agentId: number,
  payload: UpsertAgentReviewRequest
): Promise<AgentReviewItem> {
  return apiClient<AgentReviewItem>(`/api/reviews/agents/${agentId}/reviews`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface AgentPublicTrip {
  trip_id: number;
  origin_city: string;
  destination_city: string;
  departure_time: string;
  arrival_time: string;
  price: number;
  transport_type: string;
  total_seats: number;
  available_seats: number;
  suitability?: string | null;
  image_url?: string | null;
}

export async function getAgentPublicTrips(agentId: number): Promise<AgentPublicTrip[]> {
  return apiClient<AgentPublicTrip[]>(`/api/reviews/agents/${agentId}/trips`, { method: "GET" });
}

export interface MyAgentReview {
  review_id: number;
  agent_id: number;
  rating: number;
  comment?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export async function getMyReviewForAgent(agentId: number): Promise<MyAgentReview | null> {
  return apiClient<MyAgentReview | null>(`/api/reviews/agents/${agentId}/my-review`, { method: "GET" });
}

export interface TripReviewItem {
  review_id: number;
  trip_id: number;
  user_id: string;
  username?: string | null;
  rating: number;
  comment?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface UpsertTripReviewRequest {
  rating: number;
  comment?: string;
}

export async function getTripReviews(tripId: number): Promise<TripReviewItem[]> {
  return apiClient<TripReviewItem[]>(`/api/reviews/trips/${tripId}/reviews`, { method: "GET" });
}

export async function getMyReviewForTrip(tripId: number): Promise<TripReviewItem | null> {
  return apiClient<TripReviewItem | null>(`/api/reviews/trips/${tripId}/my-review`, { method: "GET" });
}

export async function upsertTripReview(
  tripId: number,
  payload: UpsertTripReviewRequest
): Promise<TripReviewItem> {
  return apiClient<TripReviewItem>(`/api/reviews/trips/${tripId}/reviews`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Agent profile (agent's own view)
export interface AgentProfileData {
  agent_id: number;
  user_id: string;
  name?: string | null;
  email?: string | null;
  verification_status?: string | null;
  rating?: number | null;
  numberofreviews?: number | null;
  contact_info?: Record<string, unknown> | null;
  profile_details?: Record<string, unknown> | null;
  created_at?: string | null;
}

export interface AgentProfileUpdate {
  name?: string;
  contact_info?: Record<string, unknown>;
  profile_details?: Record<string, unknown>;
}

export interface AgentDashboardStats {
  total_revenue: number;
  total_bookings: number;
  active_listings: number;
  pending_inquiries: number;
}

export interface AgentDashboardChartPoint {
  month: string;
  bookings: number;
}

export interface AgentDashboardRecentBooking {
  booking_id: number;
  booking_reference: string;
  booking_date: string;
  status: string;
  trip_label: string;
  traveler_name: string;
  total_price: number;
}

export interface AgentDashboardResponse {
  stats: AgentDashboardStats;
  bookings_by_month: AgentDashboardChartPoint[];
  recent_bookings: AgentDashboardRecentBooking[];
}

export async function getAgentProfile(): Promise<AgentProfileData> {
  return apiClient<AgentProfileData>("/api/profile/agent", { method: "GET" });
}

export async function getAgentDashboard(): Promise<AgentDashboardResponse> {
  return apiClient<AgentDashboardResponse>("/api/profile/agent/dashboard", { method: "GET" });
}

export async function updateAgentProfile(payload: AgentProfileUpdate): Promise<AgentProfileData> {
  return apiClient<AgentProfileData>("/api/profile/agent", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Agent passenger view
export interface PassengerDetail {
  full_name: string;
  age?: number | null;
  gender?: string | null;
  passport_number?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  dietary_restrictions?: string | null;
  medical_conditions?: string | null;
}

export interface TripBookingEntry {
  booking_id: number;
  booking_reference: string;
  booking_date: string;
  status: string;
  number_of_seats: number;
  total_price: number;
  contact_email: string;
  contact_phone: string;
  special_requests?: string | null;
  passengers: PassengerDetail[];
}

export interface TripWithPassengers {
  trip_id: number;
  origin_city: string;
  destination_city: string;
  departure_time: string;
  arrival_time: string;
  price: number;
  transport_type: string;
  total_seats: number;
  available_seats: number;
  bookings: TripBookingEntry[];
  total_booked_seats: number;
}

export async function getAgentTripPassengers(): Promise<TripWithPassengers[]> {
  return apiClient<TripWithPassengers[]>("/api/bookings/agent/passengers", { method: "GET" });
}

/**
 * Upload trip image to Supabase Storage
 */
const tripImagesBucket =
  (import.meta.env.VITE_SUPABASE_TRIP_IMAGES_BUCKET as string | undefined)?.trim() || "trip-images";
const profileImagesBucket =
  (import.meta.env.VITE_SUPABASE_PROFILE_IMAGES_BUCKET as string | undefined)?.trim() || "profile-images";

export async function uploadTripImage(file: File, tripId: number): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `trip-${tripId}-${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage.from(tripImagesBucket).upload(fileName, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    console.error("[API] Error uploading image:", error);
    const hint =
      error.message?.toLowerCase().includes("bucket") || error.message?.toLowerCase().includes("not found")
        ? ` Create a public bucket named "${tripImagesBucket}" in Supabase Storage (see backend/supabase/storage_trip_images_bucket.sql) or set VITE_SUPABASE_TRIP_IMAGES_BUCKET to your bucket name.`
        : "";
    throw new Error(`Failed to upload image: ${error.message}.${hint}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(tripImagesBucket).getPublicUrl(data.path);

  return publicUrl;
}

/**
 * Upload profile image to Supabase Storage
 */
export async function uploadProfileImage(
  file: File,
  ownerId: string,
  folder: "traveler" | "agent" = "traveler"
): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${folder}/${ownerId}-${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage.from(profileImagesBucket).upload(fileName, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) {
    const hint =
      error.message?.toLowerCase().includes("bucket") || error.message?.toLowerCase().includes("not found")
        ? ` Create a public bucket named "${profileImagesBucket}" in Supabase Storage or add the SQL from backend/supabase/storage_profile_images_bucket.sql.`
        : "";
    throw new Error(`Failed to upload profile image: ${error.message}.${hint}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(profileImagesBucket).getPublicUrl(data.path);

  return publicUrl;
}

/**
 * Booking API
 */

// Passenger Info
export interface PassengerInfo {
  full_name: string;
  age?: number;
  gender?: string;
  passport_number?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  dietary_restrictions?: string;
  medical_conditions?: string;
}

// Create Booking Request
export interface CreateBookingRequest {
  trip_id: number;
  number_of_seats: number;
  itinerary_id?: number;
  contact_email: string;
  contact_phone: string;
  special_requests?: string;
  passengers: PassengerInfo[];
}

// Booking Response
export interface BookingResponse {
  booking_id: number;
  user_id: string;
  trip_id: number;
  itinerary_id?: number;
  booking_date: string;
  status: string;
  number_of_seats: number;
  unit_price_at_booking?: number;
  total_price: number;
  passenger_names: string[];
  contact_email: string;
  contact_phone: string;
  special_requests?: string;
  booking_reference: string;
  confirmed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  refund_amount?: number;
  updated_at: string;
  trip?: {
    trip_id: number;
    origin_city: string;
    destination_city: string;
    departure_time: string;
    arrival_time: string;
    price: number;
  };
  agent_name?: string;
  /** local = public.booking; external = public.external_bookings */
  booking_source?: "local" | "external";
}

export interface BookingListResponse {
  bookings: BookingResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

/**
 * Create a new booking
 */
export async function createBooking(data: CreateBookingRequest): Promise<BookingResponse> {
  return apiClient<BookingResponse>("/api/bookings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Get all bookings for the current user
 */
export async function getMyBookings(
  statusFilter?: string,
  page: number = 1,
  pageSize: number = 6
): Promise<BookingListResponse> {
  const params = new URLSearchParams();
  if (statusFilter) {
    params.append("status_filter", statusFilter);
  }
  params.append("page", String(page));
  params.append("page_size", String(pageSize));
  const endpoint = `/api/bookings?${params.toString()}`;
  
  return apiClient<BookingListResponse>(endpoint, {
    method: "GET",
  });
}

/**
 * Get a specific booking by ID
 */
export async function getBookingById(bookingId: number): Promise<BookingResponse> {
  return apiClient<BookingResponse>(`/api/bookings/${bookingId}`, {
    method: "GET",
  });
}

/**
 * Cancel a booking
 */
export async function cancelBooking(bookingId: number, cancellationReason?: string): Promise<BookingResponse> {
  const endpoint = cancellationReason
    ? `/api/bookings/${bookingId}/cancel?cancellation_reason=${encodeURIComponent(cancellationReason)}`
    : `/api/bookings/${bookingId}/cancel`;
  
  return apiClient<BookingResponse>(endpoint, {
    method: "POST",
  });
}

/**
 * Collaboration API - Bus Pooling and Messaging
 */

// Agent Info
export interface AgentInfo {
  agent_id: number;
  user_id: string;
  agent_name?: string;
  rating?: number;
  numberofreviews?: number;
  verification_status?: string;
}

// Trip with Agent Info
export interface TripWithAgent {
  trip_id: number;
  agent_id: number;
  agent_name?: string;
  origin_city: string;
  destination_province: string;
  destination_city: string;
  departure_time: string;
  arrival_time: string;
  price: number;
  transport_type: string;
  total_seats: number;
  available_seats: number;
  suitability?: string;
  image_url?: string;
  is_tour_package?: boolean;
}

// Matching Trip
export interface MatchingTrip {
  trip: TripWithAgent;
  my_trip: TripWithAgent;
  match_score: number;
}

// Bus Pooling Request
export interface BusPoolingRequestCreate {
  target_trip_id: number;
  requester_trip_id: number;
  message?: string;
  seat_management: "combined" | "separate";
  selected_bus_agent_id: number;
}

export interface BusPoolingRequestResponse {
  request_id: number;
  requester_agent_id: number;
  requester_agent_name?: string;
  target_agent_id: number;
  target_agent_name?: string;
  requester_trip: TripWithAgent;
  target_trip: TripWithAgent;
  status: string;
  message?: string;
  seat_management?: string;
  selected_bus_agent_id?: number;
  created_at: string;
  updated_at: string;
}

export interface BusPoolingRequestUpdate {
  status: "approved" | "rejected" | "cancelled";
  selected_bus_agent_id?: number;
}

// Agent Messages
export interface AgentMessageCreate {
  receiver_agent_id: number;
  subject?: string;
  content: string;
  related_pooling_request_id?: number;
}

export interface AgentMessageResponse {
  message_id: number;
  sender_agent_id: number;
  sender_agent_name?: string;
  receiver_agent_id: number;
  receiver_agent_name?: string;
  subject?: string;
  content: string;
  related_pooling_request_id?: number;
  is_read: boolean;
  created_at: string;
}

// Collaboration Filters
export interface CollaborationTripFilters {
  destination_city?: string;
  origin_city?: string;
  departure_date?: string; // YYYY-MM-DD
  suitability?: string;
}

/**
 * Get all other travel agents
 */
export async function getOtherAgents(): Promise<AgentInfo[]> {
  return apiClient<AgentInfo[]>("/api/collaboration/agents", {
    method: "GET",
  });
}

/**
 * Get trips from other agents with filters
 */
export async function getOtherAgentsTrips(filters?: CollaborationTripFilters): Promise<TripWithAgent[]> {
  if (!filters || Object.keys(filters).length === 0) {
    return apiClient<TripWithAgent[]>("/api/collaboration/trips", {
      method: "GET",
    });
  }

  const params = new URLSearchParams();
  if (filters.destination_city) params.append("destination_city", filters.destination_city);
  if (filters.origin_city) params.append("origin_city", filters.origin_city);
  if (filters.departure_date) params.append("departure_date", filters.departure_date);
  if (filters.suitability) params.append("suitability", filters.suitability);

  const queryString = params.toString();
  const endpoint = `/api/collaboration/trips${queryString ? `?${queryString}` : ""}`;

  return apiClient<TripWithAgent[]>(endpoint, {
    method: "GET",
  });
}

/**
 * Get matching trips for bus pooling
 */
export async function getMatchingTrips(): Promise<MatchingTrip[]> {
  return apiClient<MatchingTrip[]>("/api/collaboration/matching-trips", {
    method: "GET",
  });
}

/**
 * Create a bus pooling request
 */
export async function createBusPoolingRequest(data: BusPoolingRequestCreate): Promise<BusPoolingRequestResponse> {
  return apiClient<BusPoolingRequestResponse>("/api/collaboration/bus-pooling/request", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Get bus pooling requests
 */
export async function getBusPoolingRequests(type: "sent" | "received" | "all" = "all"): Promise<BusPoolingRequestResponse[]> {
  return apiClient<BusPoolingRequestResponse[]>(`/api/collaboration/bus-pooling/requests?type=${type}`, {
    method: "GET",
  });
}

/**
 * Update bus pooling request status
 */
export async function updateBusPoolingRequest(
  requestId: number,
  data: BusPoolingRequestUpdate
): Promise<BusPoolingRequestResponse> {
  return apiClient<BusPoolingRequestResponse>(`/api/collaboration/bus-pooling/requests/${requestId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Get messages between agents
 */
export async function getMessages(agentId?: number): Promise<AgentMessageResponse[]> {
  const endpoint = agentId
    ? `/api/collaboration/messages?agent_id=${agentId}`
    : "/api/collaboration/messages";
  
  return apiClient<AgentMessageResponse[]>(endpoint, {
    method: "GET",
  });
}

/**
 * Send a message to another agent
 */
export async function sendMessage(data: AgentMessageCreate): Promise<AgentMessageResponse> {
  return apiClient<AgentMessageResponse>("/api/collaboration/messages", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Get unread message count
 */
export async function getUnreadMessageCount(): Promise<{ count: number }> {
  return apiClient<{ count: number }>("/api/collaboration/messages/unread-count", {
    method: "GET",
  });
}

export async function markAgentConversationRead(otherAgentId: number): Promise<void> {
  await apiClient<Record<string, never>>(
    `/api/collaboration/messages/read?other_agent_id=${otherAgentId}`,
    { method: "PATCH" }
  );
}

export interface AgentNotificationFeedItem {
  notification_id: string;
  category: string;
  title: string;
  body: string;
  created_at: string;
}

export async function getAgentNotificationFeed(limit = 30): Promise<AgentNotificationFeedItem[]> {
  return apiClient<AgentNotificationFeedItem[]>(
    `/api/collaboration/agent-notification-feed?limit=${limit}`,
    { method: "GET" }
  );
}


