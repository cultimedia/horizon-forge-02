import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Support both authenticated (browser) and API key (automation) access
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('x-api-key') || req.headers.get('x-ingest-key');
    const urlKey = new URL(req.url).searchParams.get('key');
    const effectiveApiKey = apiKey || urlKey;
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (effectiveApiKey) {
      // Machine/automation path
      const expectedApiKey = Deno.env.get('INGEST_API_KEY');
      if (!expectedApiKey || effectiveApiKey !== expectedApiKey) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // For API key auth, we don't have a user context — caller can pass user_id in body
    } else if (authHeader?.startsWith('Bearer ')) {
      // Browser/session path
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace('Bearer ', '');
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = data.user.id;
    } else {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse body
    let body: { text?: string; capture?: string; source?: string; user_id?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const captureText = (body.text || body.capture || '').trim();
    if (!captureText) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Text is required (use "text" or "capture" field)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (captureText.length > 10000) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Text too long (max 10,000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For API key auth, allow user_id from body
    const effectiveUserId = userId || body.user_id;

    console.log(`ingest-thought: source=${body.source || 'browser'}, userId=${effectiveUserId || 'unknown'}, len=${captureText.length}`);

    // TODO: Add OpenRouter AI processing here (classify, embed, etc.)
    // The OPENROUTER_API_KEY secret is available via Deno.env.get('OPENROUTER_API_KEY')

    return new Response(
      JSON.stringify({ ok: true, text: captureText, user_id: effectiveUserId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('ingest-thought error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
