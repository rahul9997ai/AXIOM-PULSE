// Sends a Web Push notification to one or more subscribed devices.
// Called either by a user (test push, to their own devices) or internally
// by a scheduled reminder job with a service-role key and explicit profile_ids.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

webpush.setVapidDetails(
  'mailto:007.splinter@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

interface RequestBody {
  test?: boolean;
  profile_ids?: string[];
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: 'Not authenticated' }, 401);

    const body: RequestBody = await req.json().catch(() => ({}));
    const targetIds = body.profile_ids?.length ? body.profile_ids : [user.id];

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, profile_id, endpoint, p256dh, auth')
      .in('profile_id', targetIds);

    if (error) return json({ error: error.message }, 400);

    const payload = JSON.stringify({
      title: body.title || 'AXIOM PULSE',
      body: body.body || 'Test notification — push is working.',
      data: body.data || { url: '/' },
    });

    let sent = 0;
    const stale: string[] = [];

    await Promise.all((subs || []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(sub.id);
      }
    }));

    if (stale.length) await supabase.from('push_subscriptions').delete().in('id', stale);

    return json({ sent, removed: stale.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
