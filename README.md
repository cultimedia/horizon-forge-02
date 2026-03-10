# Horizons — OpenBrain Capture System

A loop-driven cognitive capture system that lets Keith dump thoughts by voice or text and have AI sort, classify, and route them into the right life categories.

**Live app:** [horizon-forge-02.lovable.app](https://horizon-forge-02.lovable.app)

---

## What It Does

1. **Capture anything** — voice (iPad Shortcut) or typed text in the web UI
2. **AI classifies** — OpenRouter-powered pipeline extracts type, title, people, dates, and routes to the correct Horizon
3. **Semantic memory** — every capture gets a 1536-dim embedding for future agent queries via `match_tasks()`
4. **Horizon-aware routing** — the classifier reads each Horizon's description from the DB to make accurate routing decisions

## Horizons (Life Categories)

| Horizon | What Goes Here |
|---|---|
| **Sacred Technology** | AI, automation, consulting, HolyHell.io, OpenBrain, OpenClaw |
| **Home Systems** | Garden, seeds, livestock, household maintenance, supplies |
| **Learning / Research** | Reading, papers, deep-dives, skill acquisition (input, not project work) |
| **Body / Health** | Medical, bloodwork, injuries, nutrition, exercise |
| **Human Relations** | Mom, Dad, Russell, Martha, Lindsey, Alexus, Emma, Mason, Madison, Tammy |
| **Financial / Legal** | Etsy shop, POH LLC, cannabis property, invoices, rent, taxes |
| **Sanctuary Build** | House construction, land clearing, shop build |

## Architecture

| Layer | Service |
|---|---|
| Frontend | React / Vite / TypeScript / shadcn / Tailwind |
| Database | Supabase (pgvector, RLS, HNSW index) |
| AI Gateway | OpenRouter (GPT-4o-mini classify, text-embedding-3-small) |
| Email | Resend via `ops.holyhell.io` |
| Capture | `ingest-thought` edge function |

## Edge Functions

- **`ingest-thought`** — Main capture pipeline. Accepts `{ content, user_id }`, runs embedding + classification in parallel, inserts task with metadata. Dual auth: JWT (web UI) or API key (Shortcuts/CLI).
- **`cleanup-completed-tasks`** — Housekeeping for completed items.
- **`send-daily-digest`** — Email digest (Phase 2, pending rewrite).

## iPad Shortcut Integration

The system accepts voice captures from Apple Shortcuts:
- **URL:** `https://lfaxxfyfyxghdcjlokwn.supabase.co/functions/v1/ingest-thought`
- **Method:** POST
- **Headers:** `x-api-key` with your ingest key, `Content-Type: application/json`
- **Body:** `{ "content": "dictated text", "user_id": "your-uuid" }`

## Build Phases

- ✅ **Phase 0** — Schema surgery (pgvector, embeddings, metadata columns)
- ✅ **Phase 1** — `ingest-thought` deployed and working
- 🔲 **Phase 2** — Rewrite `send-daily-digest` with Resend
- 🔲 **Phase 3** — MCP server (`open-brain-mcp`) for agent queries
- 🔲 **Phase 4** — Reminders via pg_cron + `send-reminder`

## Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Lovable Cloud)
- OpenRouter
- Resend

## Development

```sh
git clone <repo-url>
cd horizon-forge-02
npm i
npm run dev
```

Or open in [Lovable](https://lovable.dev/projects/5d155ca0-083d-419b-a2ce-9d18d3c934d3) and start prompting.
