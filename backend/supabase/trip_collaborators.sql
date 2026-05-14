-- Trip Collaborators table
-- Stores collaboration invites between travel agents for specific trips.
-- Run this in the Supabase SQL Editor before using the collaborators API.

CREATE TABLE IF NOT EXISTS public.trip_collaborators (
    invite_id              bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    trip_id                bigint NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
    inviting_agent_id      bigint NOT NULL REFERENCES public.travel_agent(agent_id),
    collaborating_agent_id bigint NOT NULL REFERENCES public.travel_agent(agent_id),
    message                text,
    status                 text NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at             timestamptz DEFAULT now(),
    updated_at             timestamptz DEFAULT now(),
    -- One active invite per (trip, collaborating agent)
    UNIQUE (trip_id, collaborating_agent_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_collaborators_trip_id
    ON public.trip_collaborators (trip_id);

CREATE INDEX IF NOT EXISTS idx_trip_collaborators_collaborating_agent
    ON public.trip_collaborators (collaborating_agent_id, status);

CREATE INDEX IF NOT EXISTS idx_trip_collaborators_inviting_agent
    ON public.trip_collaborators (inviting_agent_id);
