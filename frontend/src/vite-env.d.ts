/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Supabase Storage bucket for trip images (default: trip-images) */
  readonly VITE_SUPABASE_TRIP_IMAGES_BUCKET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
