// Sends a Web Push notification to one or more subscribed devices.
// A caller may always target their own devices (test push). Targeting other
// profiles (e.g. "notify this salesperson of a new delivery") requires the
// caller to be a manager role (FSM / General Manager / Master Administrator)
// in the same dealership as every targeted profile.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MANAGER_ROLES = ['FSM', 'General Manager', 'Master Administrator'];

webpush.setVapidDetails(
  'mailto:007.splinter@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

interface RequestBody {
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

    const targetingOthers = targetIds.some((id) => id !== user.id);
    if (targetingOthers) {
      const { data: caller } = await supabase.from('profiles').select('role, dealership_id').eq('id', user.id).single();
      if (!caller || !MANAGER_ROLES.includes(caller.role)) {
        return json({ error: 'Only FSM/manager roles can notify other users' }, 403);
      }
      const { data: targets } = await supabase.from('profiles').select('id, dealership_id').in('id', targetIds);
      const unauthorized = (targets || []).some((t) => t.dealership_id !== caller.dealership_id);
      if (unauthorized || (targets || []).length !== targetIds.length) {
        return json({ error: 'Cannot notify profiles outside your dealership' }, 403);
      }
    }

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
