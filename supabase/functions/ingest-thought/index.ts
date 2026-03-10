import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-key, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Auth: accepts API key OR JWT ──────────────────────────────────
async function authenticate(req: Request): Promise<{ authenticated: boolean; userId?: string }> {
  // 1. Check API key auth (for CLI/external callers)
  const ingestKey = Deno.env.get("INGEST_API_KEY");
  const apiKeyProvided =
    req.headers.get("x-ingest-key") ??
    req.headers.get("x-api-key") ??
    req.headers.get("X-API-Key") ??
    new URL(req.url).searchParams.get("key");
  if (apiKeyProvided && apiKeyProvided === ingestKey) {
    return { authenticated: true };
  }

  // 2. Check JWT auth (for frontend callers via supabase.functions.invoke)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      return { authenticated: true, userId: data.user.id };
    }
  }

  return { authenticated: false };
}

// ── OpenRouter call ───────────────────────────────────────────────
async function openRouterChat(messages: object[], model = "openai/gpt-4o-mini") {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, max_tokens: 500 }),
  });
  if (!res.ok) throw new Error(`OpenRouter chat error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content as string;
}

// ── Embedding ─────────────────────────────────────────────────────
async function embed(text: string): Promise<number[]> {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text,
    }),
  });
  if (!res.ok) throw new Error(`Embedding error: ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

// ── Classifier ────────────────────────────────────────────────────
async function classify(content: string) {
  const today = new Date().toISOString().split("T")[0];
  const prompt = `You are a thought classifier for a personal knowledge system. Today is ${today}.

Classify the following capture and extract structured metadata. Respond ONLY with valid JSON — no markdown, no explanation.

Capture: "${content}"

Respond with this exact shape:
{
  "type": "task|idea|person_note|appointment|reference",
  "confidence": 0.0-1.0,
  "title": "clean, concise title for this item",
  "horizon": "today|this_week|this_month|someday",
  "due_at": "ISO 8601 datetime or null",
  "remind_at": "ISO 8601 datetime or null",
  "metadata": {
    "people": ["name1", "name2"],
    "tags": ["tag1", "tag2"],
    "action_items": ["action1"],
    "summary": "one sentence summary"
  }
}

Rules:
- type=task if it requires action
- type=appointment if it has a specific time/date
- type=person_note if it's primarily about a person
- type=idea if it's a thought, insight, or concept
- type=reference if it's factual info to remember
- Set remind_at only if the capture explicitly mentions wanting a reminder
- Set due_at if any date/time is mentioned
- confidence reflects how certain you are about the classification`;

  const raw = await openRouterChat([{ role: "user", content: prompt }]);
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return {
      type: "task",
      confidence: 0.5,
      title: content.slice(0, 100),
      horizon: "someday",
      due_at: null,
      remind_at: null,
      metadata: { people: [], tags: [], action_items: [], summary: content },
    };
  }
}

// ── Horizon lookup ────────────────────────────────────────────────
async function resolveHorizonId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  horizonLabel: string
): Promise<string | null> {
  const labelMap: Record<string, string[]> = {
    today: ["today", "daily", "now"],
    this_week: ["week", "weekly", "this week"],
    this_month: ["month", "monthly", "this month"],
    someday: ["someday", "later", "backlog", "inbox"],
  };
  const candidates = labelMap[horizonLabel] ?? ["inbox"];

  const { data } = await supabase
    .from("horizons")
    .select("id, name")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!data || data.length === 0) return null;

  for (const candidate of candidates) {
    const match = data.find((h: { id: string; name: string }) =>
      h.name.toLowerCase().includes(candidate)
    );
    if (match) return match.id;
  }

  return data[0].id;
}

// ── Main handler ──────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await authenticate(req);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const content: string = body.content ?? body.text ?? body.message;
    // Use user_id from body (API key auth) or from JWT (frontend auth)
    const userId: string = body.user_id ?? auth.userId;

    if (!content || !userId) {
      return new Response(
        JSON.stringify({ error: "content and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map classifier horizon labels to DB-allowed timeframe values
    const timeframeMap: Record<string, string> = {
      today: "today",
      this_week: "week",
      this_month: "backlog",
      someday: "backlog",
    };

    // Run embedding + classification in parallel
    const [embedding, classification] = await Promise.all([
      embed(content),
      classify(content),
    ]);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const horizonId = await resolveHorizonId(
      supabase,
      userId,
      classification.horizon
    );

    // Note: DB column is "due_date" not "due_at"
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        horizon_id: horizonId,
        title: classification.title,
        type: classification.type,
        embedding,
        metadata: classification.metadata,
        due_date: classification.due_at ?? null,
        remind_at: classification.remind_at ?? null,
        confidence: classification.confidence,
        notes: content,
        timeframe: timeframeMap[classification.horizon] ?? "today",
        completed: false,
      })
      .select()
      .single();

    if (error) throw error;

    // Build human-readable confirmation
    const people =
      classification.metadata.people?.length > 0
        ? ` | People: ${classification.metadata.people.join(", ")}`
        : "";
    const due = classification.due_at
      ? ` | Due: ${new Date(classification.due_at).toLocaleDateString()}`
      : "";
    const remind = classification.remind_at
      ? ` | Reminder set: ${new Date(classification.remind_at).toLocaleDateString()}`
      : "";
    const conf = Math.round(classification.confidence * 100);

    const confirmation = `✓ Captured as ${classification.type} → "${classification.title}"${people}${due}${remind} | Confidence: ${conf}%`;

    return new Response(
      JSON.stringify({
        success: true,
        confirmation,
        task_id: task.id,
        type: classification.type,
        title: classification.title,
        confidence: classification.confidence,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ingest-thought error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
