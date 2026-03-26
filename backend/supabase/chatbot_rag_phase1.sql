-- =============================================================================
-- Phase 1: Supabase RAG foundation for chatbot (Postgres + pgvector)
-- =============================================================================
-- Run in Supabase SQL Editor.
-- Creates:
--   - kb_documents
--   - kb_chunks
--   - match_kb_chunks(...) RPC for vector similarity retrieval
-- Also inserts a small seed knowledge base for immediate testing.
-- =============================================================================

create extension if not exists vector;

create table if not exists public.kb_documents (
  document_id      bigint generated always as identity primary key,
  source_key       text not null unique,
  title            text not null,
  category         text not null default 'general',
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.kb_chunks (
  chunk_id         bigint generated always as identity primary key,
  document_id      bigint not null references public.kb_documents(document_id) on delete cascade,
  chunk_text       text not null,
  chunk_index      integer not null default 0,
  metadata         jsonb not null default '{}'::jsonb,
  embedding        vector(3072) not null,
  created_at       timestamptz not null default now()
);

create index if not exists kb_chunks_document_idx
  on public.kb_chunks(document_id, chunk_index);

-- NOTE:
-- pgvector ivfflat index has a max dimension limit for `vector` that is lower than 3072.
-- For Gemini 3072-d embeddings, skip ivfflat in this phase (works fine for small/demo KB sizes).
-- If you need ANN indexing later, migrate to `halfvec(3072)` or reduce embedding dimensions.

create or replace function public.match_kb_chunks(
  query_embedding vector(3072),
  match_count int default 5,
  category_filter text default null
)
returns table (
  chunk_id bigint,
  document_id bigint,
  source_key text,
  title text,
  category text,
  chunk_text text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    c.chunk_id,
    d.document_id,
    d.source_key,
    d.title,
    d.category,
    c.chunk_text,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.kb_chunks c
  join public.kb_documents d on d.document_id = c.document_id
  where category_filter is null or d.category = category_filter
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

comment on table public.kb_documents is
  'Knowledge base document catalog for chatbot RAG retrieval.';
comment on table public.kb_chunks is
  'Embedded text chunks for vector search; generated from kb_documents/source content.';
comment on function public.match_kb_chunks(vector(3072), int, text) is
  'Returns top-k semantically similar KB chunks for a query embedding.';

-- Optional seed content for immediate demo/testing.
insert into public.kb_documents (source_key, title, category, metadata)
values
  ('tw-faq-bookings', 'TourWise Booking FAQ', 'faq', '{"version":"v1"}'),
  ('tw-faq-external', 'External Partner Trips FAQ', 'faq', '{"version":"v1"}')
on conflict (source_key) do update
set title = excluded.title,
    category = excluded.category,
    metadata = excluded.metadata,
    updated_at = now();
