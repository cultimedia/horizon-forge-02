
-- Fix match_tasks with secure search_path
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
language sql stable
security invoker
set search_path = public
as $$
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
