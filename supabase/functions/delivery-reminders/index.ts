// Scheduled job (Deno.cron, runs hourly): sends the "day before" and
// "delivery day" reminder pushes to the assigned salesperson, once each,
// for every delivery that hasn't been delivered/cancelled yet.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

webpush.setVapidDetails(
  'mailto:007.splinter@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function pushToProfile(profileId: string, title: string, body: string, data: Record<string, unknown>) {
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('profile_id', profileId);

  const stale: string[] = [];
  await Promise.all((subs || []).map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, data }),
      );
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) stale.push(sub.id);
    }
  }));
  if (stale.length) await admin.from('push_subscriptions').delete().in('id', stale);
}

async function runReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);

  const { data: deliveries } = await admin
    .from('deliveries')
    .select('id, salesperson_id, customer_name, vehicle, delivery_at, reminder_24h_sent_at, reminder_day_of_sent_at')
    .in('status', ['new', 'requirements_outstanding', 'ready'])
    .lte('delivery_at', in24h.toISOString())
    .gte('delivery_at', now.toISOString());

  for (const d of deliveries || []) {
    const deliveryAt = new Date(d.delivery_at);
    const isToday = deliveryAt <= endOfToday;

    if (!d.reminder_day_of_sent_at && isToday) {
      await pushToProfile(
        d.salesperson_id,
        'Delivery today',
        `${d.customer_name} — ${d.vehicle} at ${deliveryAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        { url: '/', deliveryId: d.id, type: 'delivery_time' },
      );
      await admin.from('deliveries').update({ reminder_day_of_sent_at: now.toISOString() }).eq('id', d.id);
    } else if (!d.reminder_24h_sent_at && !isToday) {
      await pushToProfile(
        d.salesperson_id,
        'Delivery tomorrow',
        `${d.customer_name} — ${d.vehicle}, ${deliveryAt.toLocaleString()}`,
        { url: '/', deliveryId: d.id, type: 'delivery_reminder' },
      );
      await admin.from('deliveries').update({ reminder_24h_sent_at: now.toISOString() }).eq('id', d.id);
    }
  }
}

Deno.cron('delivery-reminders-hourly', '0 * * * *', async () => {
  await runReminders();
});

// Also callable directly (e.g. for manual testing) via an HTTP request.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  await runReminders();
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
