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
}

interface Horizon {
  id: string;
  name: string;
  color: string;
}

interface UserSettings {
  user_id: string;
  email_for_digest: string;
  notification_time: string | null;
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

const generateEmailHTML = (
  tasks: Task[], 
  horizons: Horizon[], 
  weekTasks: Task[]
): string => {
  const horizonMap = new Map(horizons.map(h => [h.id, h]));
  
  // Group today's tasks by horizon
  const tasksByHorizon = new Map<string, Task[]>();
  tasks.forEach(task => {
    const existing = tasksByHorizon.get(task.horizon_id) || [];
    tasksByHorizon.set(task.horizon_id, [...existing, task]);
  });

  const todayTasksHTML = Array.from(tasksByHorizon.entries())
    .map(([horizonId, horizonTasks]) => {
      const horizon = horizonMap.get(horizonId);
      const horizonName = horizon?.name || 'Unknown';
      const horizonColor = horizon?.color || '#38b5b5';
      
      const tasksListHTML = horizonTasks
        .map(t => `<li style="margin: 8px 0; color: #e0e0e0;">${t.title}</li>`)
        .join('');
      
      return `
        <div style="margin-bottom: 24px;">
          <h3 style="color: ${horizonColor}; margin: 0 0 12px 0; font-size: 16px; font-weight: 500;">
            ${horizonName}
          </h3>
          <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
            ${tasksListHTML}
          </ul>
        </div>
      `;
    })
    .join('');

  // This week's deadlines (tasks with due dates this week, not today)
  const weekDeadlinesHTML = weekTasks.length > 0
    ? `
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #333;">
        <h2 style="color: #38b5b5; margin: 0 0 16px 0; font-size: 18px; font-weight: 400;">
          This Week's Deadlines
        </h2>
        <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
          ${weekTasks.map(t => {
            const horizon = horizonMap.get(t.horizon_id);
            const dueDate = t.due_date ? new Date(t.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
            return `<li style="margin: 8px 0; color: #e0e0e0;">
              ${t.title} 
              <span style="color: #888; font-size: 12px;">(${dueDate} · ${horizon?.name || 'Unknown'})</span>
            </li>`;
          }).join('')}
        </ul>
      </div>
    `
    : '';

  const emptyMessage = tasks.length === 0 
    ? '<p style="color: #888; font-style: italic;">No tasks scheduled for today. A clear day awaits.</p>'
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 24px;">
        <header style="margin-bottom: 32px;">
          <h1 style="color: #f0f0f0; margin: 0 0 8px 0; font-size: 24px; font-weight: 300; letter-spacing: 0.5px;">
            Your 10am Brief
          </h1>
          <p style="color: #666; margin: 0; font-size: 14px;">
            ${formatDate(new Date())}
          </p>
        </header>
        
        <main>
          <h2 style="color: #38b5b5; margin: 0 0 20px 0; font-size: 18px; font-weight: 400;">
            Today's Focus
          </h2>
          ${emptyMessage}
          ${todayTasksHTML}
          ${weekDeadlinesHTML}
        </main>
        
        <footer style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #222;">
          <p style="color: #555; font-size: 12px; margin: 0;">
            Sent from Horizons · Your constellation of intentions
          </p>
        </footer>
      </div>
    </body>
    </html>
  `;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users with email_for_digest configured
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('user_id, email_for_digest, notification_time')
      .not('email_for_digest', 'is', null);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(JSON.stringify({ error: settingsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!settings || settings.length === 0) {
      console.log('No users with digest email configured');
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${settings.length} users with digest configured`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    let sentCount = 0;
    const errors: string[] = [];

    for (const userSetting of settings as UserSettings[]) {
      try {
        // Fetch user's horizons
        const { data: horizons, error: horizonsError } = await supabase
          .from('horizons')
          .select('id, name, color')
          .eq('user_id', userSetting.user_id)
          .eq('is_active', true);

        if (horizonsError) {
          console.error(`Error fetching horizons for user ${userSetting.user_id}:`, horizonsError);
          errors.push(`User ${userSetting.user_id}: ${horizonsError.message}`);
          continue;
        }

        // Fetch today's tasks
        const { data: todayTasks, error: todayError } = await supabase
          .from('tasks')
          .select('id, title, due_date, horizon_id, timeframe, completed')
          .eq('user_id', userSetting.user_id)
          .eq('completed', false)
          .eq('timeframe', 'today');

        if (todayError) {
          console.error(`Error fetching today tasks for user ${userSetting.user_id}:`, todayError);
          errors.push(`User ${userSetting.user_id}: ${todayError.message}`);
          continue;
        }

        // Fetch this week's tasks (excluding today)
        const { data: weekTasks, error: weekError } = await supabase
          .from('tasks')
          .select('id, title, due_date, horizon_id, timeframe, completed')
          .eq('user_id', userSetting.user_id)
          .eq('completed', false)
          .eq('timeframe', 'week')
          .not('due_date', 'is', null)
          .gte('due_date', tomorrow.toISOString())
          .lt('due_date', endOfWeek.toISOString())
          .order('due_date', { ascending: true });

        if (weekError) {
          console.error(`Error fetching week tasks for user ${userSetting.user_id}:`, weekError);
          errors.push(`User ${userSetting.user_id}: ${weekError.message}`);
          continue;
        }

        const emailHTML = generateEmailHTML(
          (todayTasks || []) as Task[],
          (horizons || []) as Horizon[],
          (weekTasks || []) as Task[]
        );

        const emailResponse = await resend.emails.send({
          from: 'Horizons <digest@ops.holyhell.io>',
          to: [userSetting.email_for_digest],
          subject: `Your 10am Brief - ${formatDate(new Date())}`,
          html: emailHTML,
        });

        console.log(`Email sent to ${userSetting.email_for_digest}:`, emailResponse);
        sentCount++;
      } catch (userError) {
        console.error(`Error processing user ${userSetting.user_id}:`, userError);
        errors.push(`User ${userSetting.user_id}: ${String(userError)}`);
      }
    }

    console.log(`Daily digest complete: ${sentCount} emails sent, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        total: settings.length,
        errors: errors.length > 0 ? errors : undefined 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Daily digest function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
