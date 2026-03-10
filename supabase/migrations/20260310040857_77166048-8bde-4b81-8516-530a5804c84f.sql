
-- Enable pgvector
create extension if not exists vector;

-- Add AI/brain columns to tasks
alter table tasks 
  add column if not exists type text default 'task',
  add column if not exists embedding vector(1536),
  add column if not exists metadata jsonb default '{}',
  add column if not exists remind_at timestamptz,
  add column if not exists confidence float default 1.0;

-- Semantic search function
create or replace function match_tasks(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 10
)
returns table(
  id uuid,
  content text,
  type text,
  metadata jsonb,
  similarity float
)
language sql stable as $$
  select 
    id,
    title as content,
    type,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from tasks
  where embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;

-- Index for vector search performance (HNSW - works well with any dataset size)
create index if not exists tasks_embedding_idx 
  on tasks using hnsw (embedding vector_cosine_ops);
