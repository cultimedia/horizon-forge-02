import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  horizon_id: string;
  timeframe: string;
  completed: boolean;
  created_at: string;
  remind_at: string | null;
}

interface Horizon {
  id: string;
  name: string;
  color: string;
}

interface UserSettings {
  user_id: string;
  email_for_digest: string;
}

const formatDate = (date: Date): string =>
  date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const generateEmailHTML = (
  upcoming: Task[],
  reminders: Task[],
  stuck: Task | null,
  horizonMap: Map<string, Horizon>
): string => {
  const taskLine = (t: Task): string => {
    const h = horizonMap.get(t.horizon_id);
    const due = t.due_date ? ` · due ${shortDate(t.due_date)}` : '';
    return `<li style="margin:6px 0;color:#e0e0e0;">${t.title}<span style="color:#666;font-size:12px;"> (${h?.name || '—'}${due})</span></li>`;
  };

  const upcomingHTML = upcoming.length > 0
    ? `<h2 style="color:#38b5b5;margin:0 0 12px;font-size:16px;font-weight:400;">Upcoming</h2>
       <ul style="margin:0 0 24px;padding-left:20px;list-style:disc;">${upcoming.map(taskLine).join('')}</ul>`
    : '<p style="color:#888;font-style:italic;margin:0 0 24px;">No upcoming tasks. A clear day awaits.</p>';

  const remindersHTML = reminders.length > 0
    ? `<h2 style="color:#d4a853;margin:0 0 12px;font-size:16px;font-weight:400;">Reminders (next 24h)</h2>
       <ul style="margin:0 0 24px;padding-left:20px;list-style:disc;">${reminders.map(taskLine).join('')}</ul>`
    : '';

  const stuckHTML = stuck
    ? `<div style="margin-top:8px;padding:16px;border-left:3px solid #e05555;background:#1a1a1a;">
         <p style="color:#e05555;margin:0 0 4px;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:1px;">Stuck Item</p>
         <p style="color:#e0e0e0;margin:0;">${stuck.title} <span style="color:#666;font-size:12px;">(${horizonMap.get(stuck.horizon_id)?.name || '—'} · created ${shortDate(stuck.created_at)})</span></p>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <header style="margin-bottom:28px;">
    <h1 style="color:#f0f0f0;margin:0 0 6px;font-size:22px;font-weight:300;letter-spacing:0.5px;">Your Daily Brief</h1>
    <p style="color:#555;margin:0;font-size:13px;">${formatDate(new Date())}</p>
  </header>
  ${upcomingHTML}
  ${remindersHTML}
  ${stuckHTML}
  <footer style="margin-top:40px;padding-top:20px;border-top:1px solid #222;">
    <p style="color:#444;font-size:11px;margin:0;">Sent from Horizons · Your constellation of intentions</p>
  </footer>
</div></body></html>`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resend = new Resend(resendApiKey);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get users with digest configured
    const { data: settings, error: settingsErr } = await supabase
      .from('settings')
      .select('user_id, email_for_digest')
      .not('email_for_digest', 'is', null);

    if (settingsErr) throw settingsErr;
    if (!settings?.length) {
      return new Response(JSON.stringify({ success: true, sent: 0, skipped: 0, message: 'No users with digest configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const user of settings as UserSettings[]) {
      try {
        // Parallel fetch: horizons, upcoming tasks, reminder tasks, stuck item
        const [horizonsRes, upcomingRes, remindersRes, stuckRes] = await Promise.all([
          supabase.from('horizons').select('id, name, color').eq('user_id', user.user_id).eq('is_active', true),
          supabase.from('tasks').select('id, title, due_date, horizon_id, timeframe, completed, created_at, remind_at')
            .eq('user_id', user.user_id).eq('completed', false)
            .not('due_date', 'is', null)
            .gte('due_date', now.toISOString())
            .order('due_date', { ascending: true }).limit(3),
          supabase.from('tasks').select('id, title, due_date, horizon_id, timeframe, completed, created_at, remind_at')
            .eq('user_id', user.user_id).eq('completed', false)
            .not('remind_at', 'is', null)
            .gte('remind_at', now.toISOString())
            .lte('remind_at', in24h.toISOString()),
          supabase.from('tasks').select('id, title, due_date, horizon_id, timeframe, completed, created_at, remind_at')
            .eq('user_id', user.user_id).eq('completed', false)
            .order('created_at', { ascending: true }).limit(1),
        ]);

        if (horizonsRes.error) throw horizonsRes.error;

        const horizonMap = new Map((horizonsRes.data as Horizon[]).map(h => [h.id, h]));
        const upcoming = (upcomingRes.data || []) as Task[];
        const reminders = (remindersRes.data || []) as Task[];
        const stuck = (stuckRes.data?.[0] || null) as Task | null;

        // Skip if nothing to report
        if (upcoming.length === 0 && reminders.length === 0 && !stuck) {
          skipped++;
          continue;
        }

        // Deduplicate: remove reminder items that already appear in upcoming
        const upcomingIds = new Set(upcoming.map(t => t.id));
        const uniqueReminders = reminders.filter(t => !upcomingIds.has(t.id));

        // Don't show stuck item if it's already in upcoming or reminders
        const allShownIds = new Set([...upcomingIds, ...uniqueReminders.map(t => t.id)]);
        const finalStuck = stuck && !allShownIds.has(stuck.id) ? stuck : null;

        const html = generateEmailHTML(upcoming, uniqueReminders, finalStuck, horizonMap);

        await resend.emails.send({
          from: 'Horizons <brain@ops.holyhell.io>',
          to: [user.email_for_digest],
          subject: `Your Daily Brief — ${formatDate(new Date())}`,
          html,
        });

        sent++;
        console.log(`✓ Digest sent to ${user.email_for_digest}`);
      } catch (userErr) {
        const msg = `User ${user.user_id}: ${String(userErr)}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    console.log(`Daily digest: ${sent} sent, ${skipped} skipped, ${errors.length} errors`);
    return new Response(JSON.stringify({ success: true, sent, skipped, total: settings.length, errors: errors.length > 0 ? errors : undefined }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Daily digest error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
