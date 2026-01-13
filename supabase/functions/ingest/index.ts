import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // API Key authentication (machine-first, no session/cookie/CSRF)
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('INGEST_API_KEY');

    if (!expectedApiKey) {
      console.error('INGEST_API_KEY not configured');
      return new Response(
        JSON.stringify({ ok: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!apiKey || apiKey !== expectedApiKey) {
      console.log('Unauthorized ingest attempt - invalid or missing API key');
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let body: { capture?: string; text?: string; source?: string; timestamp?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Accept both "capture" (from Shortcuts) and "text" (from browser) field names
    const captureText = body.capture || body.text;

    if (!captureText || typeof captureText !== 'string' || !captureText.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Capture text is required (use "capture" or "text" field)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate text length (prevent abuse)
    if (captureText.length > 10000) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Text too long (max 10,000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const TASKADE_TOKEN = Deno.env.get('TASKADE_TOKEN');
    const TASKADE_PROJECT_ID = Deno.env.get('TASKADE_PROJECT_ID');

    if (!TASKADE_TOKEN || !TASKADE_PROJECT_ID) {
      console.error('Missing Taskade configuration');
      return new Response(
        JSON.stringify({ ok: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the content with optional metadata
    let content = captureText.trim();
    if (body.source) {
      content = `[${body.source}] ${content}`;
    }

    const payload = {
      tasks: [
        {
          content,
          contentType: 'text/plain',
          placement: 'beforeend',
          taskId: null
        }
      ]
    };

    console.log(`Ingest request - source: ${body.source || 'unknown'}, length: ${captureText.length}`);

    const response = await fetch(`https://www.taskade.com/api/v1/projects/${TASKADE_PROJECT_ID}/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TASKADE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Taskade API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to save capture' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Ingest successful');

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Ingest error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
