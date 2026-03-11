# OpenBrain / Horizons — Claude Code Handoff

## What You're Building

One system, two interfaces. The same Supabase database serves:
1. **Keith** (typing into the Horizons web/mobile UI)
2. **Agents** (OpenClaw and future MCP clients querying via semantic search)

This is not a notes app. It's a loop-driven cognitive system with an agent-readable memory layer bolted underneath it.

---

## The Stack

| Layer | Service | Status |
|---|---|---|
| Frontend | Horizons (Lovable) — React/Vite/TypeScript/shadcn | ✅ Live, working |
| Database | Supabase project `lfaxxfyfyxghdcjlokwn` | ✅ Schema migrated |
| Email | Resend, sending domain `ops.holyhell.io` | ✅ DNS verified |
| AI gateway | OpenRouter | ✅ Key set |
| Capture function | `ingest-thought` | ✅ Deployed |
| Digest function | `send-daily-digest` | ✅ Rewritten, cron active |
| MCP server | `open-brain-mcp` | ✅ Deployed |
| Reminders | pg_cron + `send-reminder` function | 🔲 Phase 4 |

---

## Supabase Project

- **Project ref:** `lfaxxfyfyxghdcjlokwn`
- **URL:** `https://lfaxxfyfyxghdcjlokwn.supabase.co`
- **Horizons app:** `https://horizon-forge-02.lovable.app`
- **GitHub repo:** `https://github.com/cultimedia/horizon-forge-02`

---

## Existing Schema (post-migration)

### `horizons`
```
id, user_id, name, description, color, is_active, sort_order, created_at, updated_at
```
This is the UI organizing layer. Tasks belong to horizons. Examples: "Today", "This Week", "Someday". Keep it.

### `tasks`
```
id, user_id, horizon_id, title, timeframe, due_date, completed, completed_at,
notes, created_at, updated_at,
-- NEW (Phase 0, already migrated):
type, embedding (vector 1536), metadata (jsonb), remind_at, confidence
```

### `settings`
```
id, user_id, notification_time, email_for_digest, default_horizon_id, created_at, updated_at
```

### Functions
- `match_tasks(query_embedding, match_threshold, match_count)` — semantic search, already created
- `update_updated_at_column()` — trigger, already exists

### Indexes
- HNSW index on `tasks.embedding` — already created

### RLS
All tables have RLS enabled. Per-user isolation via `auth.uid() = user_id`. Service role bypasses this (use service role key in edge functions).

---

## Existing Edge Functions

| Function | Status | Action |
|---|---|---|
| `taskade-capture` | Obsolete — sends to Taskade | Leave alone, will stop being called |
| `ingest` | Unknown — check logs | Audit, may overlap with new function |
| `cleanup-completed-tasks` | Fine as-is | Leave alone |
| `send-daily-digest` | Exists, needs rewrite | Phase 2 |

---

## Existing Secrets (already set in Supabase)

- `TASKADE_TOKEN` — obsolete, ignore
- `TASKADE_PROJECT_ID` — obsolete, ignore
- `INGEST_API_KEY` — keep, used for auth on ingest endpoint
- `RESEND_API_KEY` — keep, email delivery
- `SUPABASE_URL` — auto-available in edge functions
- `SUPABASE_SERVICE_ROLE_KEY` — auto-available in edge functions

**Secret to add:**
- `OPENROUTER_API_KEY` — Keith is getting this from openrouter.ai

---

## Build Phases

### ✅ Phase 0 — Schema Surgery (COMPLETE)
- pgvector enabled
- 5 new columns on tasks: type, embedding, metadata, remind_at, confidence
- match_tasks() function created
- HNSW index created

---

### 🔲 Phase 1 — Deploy `ingest-thought` (NEXT)

The function is already written. File location in this folder: `ingest-thought/index.ts`

**What it does:**
- Receives `{ content, user_id }` via POST
- Runs embedding + classification in parallel via OpenRouter
- Embedding model: `openai/text-embedding-3-small` (1536 dimensions)
- Classification model: `openai/gpt-4o-mini`
- Extracts: type, title, horizon, due_at, remind_at, metadata (people, tags, action_items)
- Confidence-scored — low confidence items still save but are flagged
- Preserves raw capture in `notes`, clean title in `title`
- Maps horizon label to actual horizon_id by fuzzy name matching
- Returns human-readable confirmation string

**Auth:** `x-ingest-key` header OR `?key=` query param, matched against `INGEST_API_KEY` secret

**Deploy command:**
```bash
supabase functions deploy ingest-thought --no-verify-jwt
```

**After deploy:** Update the Horizons frontend (in Lovable) to POST to `ingest-thought` instead of `taskade-capture`. The payload shape is the same: `{ content, user_id }`.

**Test:**
```bash
curl -X POST \
  https://lfaxxfyfyxghdcjlokwn.supabase.co/functions/v1/ingest-thought \
  -H "x-ingest-key: YOUR_INGEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Call Marcus Thursday about moving to the platform team", "user_id": "YOUR_USER_ID"}'
```

Expected response:
```json
{
  "success": true,
  "confirmation": "✓ Captured as task → \"Call Marcus about platform team\" | People: Marcus | Due: Thu Mar 12 | Confidence: 91%",
  "task_id": "...",
  "type": "task",
  "title": "Call Marcus about platform team",
  "confidence": 0.91
}
```

---

### 🔲 Phase 2 — Rewrite `send-daily-digest`

Rewrite the existing function. Keep the same function name. Resend is already wired.

**What it should do:**
1. Query `settings` for all users who have `email_for_digest` set
2. For each user, pull:
   - Top 3 tasks ordered by `due_date` proximity (non-completed)
   - Any tasks where `remind_at` is within next 24 hours
   - 1 task with oldest `created_at` that's still `completed = false` (the stuck item)
3. Compose a ≤150 word digest email
4. Send via Resend from `brain@ops.holyhell.io`

**Sending domain:** `ops.holyhell.io` (DNS verified, DKIM set up)

**Schedule:** Already likely on a cron. Check Supabase dashboard → Edge Functions → `send-daily-digest` for existing schedule. Should fire at `notification_time` from settings table, or default 8am user's local time.

---

### 🔲 Phase 3 — MCP Server (`open-brain-mcp`)

New edge function. This is what opens the door for OpenClaw and any other MCP client.

**Tools to implement:**
1. `search_thoughts` — calls `match_tasks()` with a semantic query embedding
2. `browse_recent` — filter tasks by type, horizon, date range, no embedding needed
3. `capture_thought` — write directly to brain from any agent (same pipeline as ingest-thought)
4. `get_stats` — counts by type, most mentioned people from metadata, oldest open items

**Auth:** Same `INGEST_API_KEY` pattern, passed as `?key=` in the connection URL

**Connection URL format:**
```
https://lfaxxfyfyxghdcjlokwn.supabase.co/functions/v1/open-brain-mcp?key=YOUR_INGEST_API_KEY
```

**Protocol:** SSE-based MCP (compatible with Claude Desktop, Claude Code, ChatGPT with dev mode, Cursor)

**Reference:** The Open Brain guide by Nate Jones (in project files) has a working MCP implementation pattern. Adapt it to query the `tasks` table instead of a `thoughts` table.

**Connect to Claude Desktop after deploy:**
Settings → Connectors → Add custom connector → paste connection URL

---

### 🔲 Phase 4 — Reminders via pg_cron + `send-reminder`

**Enable pg_cron** in Supabase dashboard → Database → Extensions → search "pg_cron" → enable.

**New edge function: `send-reminder`**
- Queries tasks where `remind_at` is within the next 60 minutes AND `completed = false`
- Joins to `settings` to get user's email
- Sends targeted reminder email via Resend
- Sets `remind_at = null` on sent items so they don't fire again

**Schedule SQL (run in SQL editor after pg_cron enabled):**
```sql
select cron.schedule(
  'reminder-check',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://lfaxxfyfyxghdcjlokwn.supabase.co/functions/v1/send-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingest-key', current_setting('app.ingest_api_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Note: You'll need to set the `ingest_api_key` app setting or hardcode the key in the cron body (less ideal). Alternative: make `send-reminder` authenticate via the service role key instead, which is auto-available.

---

## Architecture Principles (Don't Break These)

1. **One capture behavior** — Keith dumps anything, AI does the sorting
2. **Taskade is dead** — do not re-introduce any Taskade dependency
3. **Owned infrastructure only** — Supabase + OpenRouter + Resend. No new SaaS middlemen.
4. **Lovable is UI only** — edge functions live in Supabase, never in Lovable
5. **Service role key in edge functions only** — never expose it to the frontend
6. **The `notes` field preserves raw capture** — `title` is the AI-cleaned version
7. **Confidence < 0.5 still saves** — just flags in metadata for review, never discards

---

## Who This Is For

**Keith Wilkins** — HolyHell.io, Sacred Technology consulting, rural Oklahoma. Self-taught AI/automation. INTJ, 100th percentile conscientiousness. Builds systems that work while he doesn't. Dislikes SaaS chains, middlemen, and beginner-level explanations. Expects minimal elegant architectures.

He wants to rattle off thoughts by voice or text on his phone, have the AI sort it out, get reminders when things are due, and have OpenClaw (or whatever agent ships next week) be able to query everything he's ever captured by meaning.

That's it. Build that.

---

## Files In This Folder

- `CLAUDE.md` — this file
- `ingest-thought/index.ts` — Phase 1 edge function, ready to deploy
