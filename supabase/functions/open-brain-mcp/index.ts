import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "@supabase/supabase-js";

// ── Auth: API key via header or query param ──────────────────────
function authenticateRequest(req: Request): boolean {
  const accessKey = Deno.env.get("MCP_ACCESS_KEY") || Deno.env.get("INGEST_API_KEY");
  if (!accessKey) return false;

  const provided =
    req.headers.get("x-api-key") ??
    req.headers.get("x-ingest-key") ??
    new URL(req.url).searchParams.get("key");

  return provided === accessKey;
}

// ── Supabase client (service role) ───────────────────────────────
function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── User ID (single-user system for now) ─────────────────────────
const USER_ID = "971ed74f-f91c-47e2-aae8-8db9fb112ea2";

// ── Embedding helper ─────────────────────────────────────────────
async function embed(text: string): Promise<number[]> {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "openai/text-embedding-3-small", input: text }),
  });
  if (!res.ok) throw new Error(`Embedding error: ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

// ── MCP Server ───────────────────────────────────────────────────
const mcpServer = new McpServer({
  name: "open-brain",
  version: "1.0.0",
});

// Tool 1: search_thoughts — semantic search
mcpServer.tool({
  name: "search_thoughts",
  description: "Semantic search across all captured thoughts, tasks, and notes. Returns the most relevant matches by meaning.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Natural language search query" },
      limit: { type: "number", description: "Max results (default 10, max 25)" },
      threshold: { type: "number", description: "Similarity threshold 0-1 (default 0.5)" },
    },
    required: ["query"],
  },
  handler: async ({ query, limit, threshold }) => {
    const embedding = await embed(query as string);
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("match_tasks", {
      query_embedding: `[${embedding.join(",")}]`,
      match_threshold: (threshold as number) ?? 0.5,
      match_count: Math.min((limit as number) ?? 10, 25),
    });

    if (error) throw error;

    const results = (data || []).map((r: Record<string, unknown>) => ({
      title: r.content,
      type: r.type,
      similarity: Math.round((r.similarity as number) * 100) + "%",
      metadata: r.metadata,
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
    };
  },
});

// Tool 2: browse_recent — filter/browse tasks
mcpServer.tool({
  name: "browse_recent",
  description: "Browse and filter tasks by type, horizon, date range, or completion status. Good for reviewing what's been captured recently.",
  inputSchema: {
    type: "object",
    properties: {
      type: { type: "string", description: "Filter by type: task, idea, person_note, appointment, reference" },
      horizon: { type: "string", description: "Filter by horizon name (partial match)" },
      completed: { type: "boolean", description: "Filter by completion status (default: false)" },
      days: { type: "number", description: "Look back N days (default 7)" },
      limit: { type: "number", description: "Max results (default 20, max 50)" },
    },
  },
  handler: async ({ type, horizon, completed, days, limit }) => {
    const supabase = getSupabase();
    const lookback = new Date();
    lookback.setDate(lookback.getDate() - ((days as number) ?? 7));

    let query = supabase
      .from("tasks")
      .select("id, title, type, timeframe, due_date, created_at, completed, notes, metadata, horizon_id")
      .eq("user_id", USER_ID)
      .gte("created_at", lookback.toISOString())
      .order("created_at", { ascending: false })
      .limit(Math.min((limit as number) ?? 20, 50));

    if (type) query = query.eq("type", type as string);
    if (typeof completed === "boolean") query = query.eq("completed", completed);
    else query = query.eq("completed", false);

    const { data: tasks, error } = await query;
    if (error) throw error;

    // If horizon filter, resolve name to id
    let filtered = tasks || [];
    if (horizon) {
      const { data: horizons } = await supabase
        .from("horizons")
        .select("id, name")
        .eq("user_id", USER_ID)
        .ilike("name", `%${horizon}%`);
      const ids = new Set((horizons || []).map((h: { id: string }) => h.id));
      filtered = filtered.filter((t: { horizon_id: string }) => ids.has(t.horizon_id));
    }

    // Enrich with horizon names
    const { data: allHorizons } = await supabase
      .from("horizons")
      .select("id, name, color")
      .eq("user_id", USER_ID);
    const hMap = new Map((allHorizons || []).map((h: { id: string; name: string; color: string }) => [h.id, h.name]));

    const results = filtered.map((t: Record<string, unknown>) => ({
      title: t.title,
      type: t.type,
      horizon: hMap.get(t.horizon_id as string) || "Unknown",
      due_date: t.due_date,
      created: t.created_at,
      completed: t.completed,
      notes: t.notes ? (t.notes as string).slice(0, 200) : null,
      people: (t.metadata as Record<string, unknown>)?.people || [],
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
    };
  },
});

// Tool 3: get_stats — analytics on your brain
mcpServer.tool({
  name: "get_stats",
  description: "Get analytics on your brain: counts by type/horizon, most mentioned people, oldest stuck tasks, and capture velocity.",
  inputSchema: {
    type: "object",
    properties: {},
  },
  handler: async () => {
    const supabase = getSupabase();

    const [tasksRes, horizonsRes] = await Promise.all([
      supabase.from("tasks").select("id, type, horizon_id, completed, created_at, metadata").eq("user_id", USER_ID),
      supabase.from("horizons").select("id, name").eq("user_id", USER_ID).eq("is_active", true),
    ]);

    const tasks = tasksRes.data || [];
    const horizons = horizonsRes.data || [];
    const hMap = new Map(horizons.map((h: { id: string; name: string }) => [h.id, h.name]));

    // Counts by type
    const byType: Record<string, number> = {};
    tasks.forEach((t: { type: string | null }) => {
      const tp = t.type || "task";
      byType[tp] = (byType[tp] || 0) + 1;
    });

    // Counts by horizon
    const byHorizon: Record<string, { total: number; open: number }> = {};
    tasks.forEach((t: { horizon_id: string; completed: boolean | null }) => {
      const name = hMap.get(t.horizon_id) || "Unknown";
      if (!byHorizon[name]) byHorizon[name] = { total: 0, open: 0 };
      byHorizon[name].total++;
      if (!t.completed) byHorizon[name].open++;
    });

    // Most mentioned people
    const peopleCounts: Record<string, number> = {};
    tasks.forEach((t: { metadata: Record<string, unknown> | null }) => {
      const people = (t.metadata as Record<string, unknown>)?.people as string[] | undefined;
      if (people) people.forEach((p: string) => { peopleCounts[p] = (peopleCounts[p] || 0) + 1; });
    });
    const topPeople = Object.entries(peopleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, mentions: count }));

    // Oldest open tasks (stuck items)
    const openTasks = tasks
      .filter((t: { completed: boolean | null }) => !t.completed)
      .sort((a: { created_at: string }, b: { created_at: string }) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .slice(0, 5)
      .map((t: { title: string; created_at: string }) => ({
        title: t.title,
        created: t.created_at,
        age_days: Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000),
      }));

    // Capture velocity (last 7 days vs prior 7)
    const now = Date.now();
    const week1 = tasks.filter((t: { created_at: string }) => now - new Date(t.created_at).getTime() < 7 * 86400000).length;
    const week2 = tasks.filter((t: { created_at: string }) => {
      const age = now - new Date(t.created_at).getTime();
      return age >= 7 * 86400000 && age < 14 * 86400000;
    }).length;

    const stats = {
      total_items: tasks.length,
      open_items: tasks.filter((t: { completed: boolean | null }) => !t.completed).length,
      by_type: byType,
      by_horizon: byHorizon,
      top_people: topPeople,
      stuck_items: openTasks,
      velocity: { this_week: week1, last_week: week2 },
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }],
    };
  },
});

// Tool 4: capture_thought — write to brain from any agent
mcpServer.tool({
  name: "capture_thought",
  description: "Capture a thought, task, or note into the brain. Runs the full AI classification and embedding pipeline.",
  inputSchema: {
    type: "object",
    properties: {
      content: { type: "string", description: "The raw thought or task to capture" },
    },
    required: ["content"],
  },
  handler: async ({ content }) => {
    // Proxy to ingest-thought for full pipeline
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const apiKey = Deno.env.get("MCP_ACCESS_KEY") || Deno.env.get("INGEST_API_KEY")!;

    const res = await fetch(`${supabaseUrl}/functions/v1/ingest-thought`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ingest-key": apiKey,
      },
      body: JSON.stringify({ content, user_id: USER_ID }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Capture failed");

    return {
      content: [{ type: "text" as const, text: data.confirmation || JSON.stringify(data) }],
    };
  },
});

// ── Hono app with auth middleware ────────────────────────────────
const app = new Hono();
const transport = new StreamableHttpTransport();

// Auth middleware for all routes
app.use("*", async (c, next) => {
  // Allow OPTIONS for CORS
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-ingest-key",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      },
    });
  }

  if (!authenticateRequest(c.req.raw)) {
    return new Response(JSON.stringify({ error: "Unauthorized — provide key via ?key= or x-api-key header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  await next();
});

app.all("/*", async (c) => {
  return await transport.handleRequest(c.req.raw, mcpServer);
});

Deno.serve(app.fetch);
