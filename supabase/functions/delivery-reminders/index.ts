// Scheduled job (Deno.cron, runs every 15 minutes): sends four reminder
// tiers to the assigned salesperson, each exactly once per delivery —
// 24 hours before, 9AM the day of, 2 hours before, and at delivery time
// (the most urgent, requireInteraction on the client so it doesn't
// auto-dismiss). Every tier's body names the still-outstanding
// requirements so the salesperson knows exactly what to have ready, not
// just that a delivery is coming up.
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

// Dealerships in this build are all Ontario-based — reminders are timed
// against Eastern local time (e.g. "9AM the day of").
const DEALERSHIP_TZ = 'America/Toronto';

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

function todoSuffix(labels: string[]): string {
  return labels.length ? ` Still needed: ${labels.join(', ')}.` : ' Nothing outstanding.';
}

// The nudge to actually finish the checklist and close out the delivery —
// used on every tier from the day-of onward, once it's actionable today.
const ACTION_LINE = 'Please make sure every delivery requirement is completed, then mark the vehicle delivered.';

function localHour(d: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: DEALERSHIP_TZ, hour: 'numeric', hour12: false }).format(d));
}

async function runReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const gracePast = new Date(now.getTime() - 2 * 60 * 60 * 1000); // catch a just-passed delivery time
  const isSameLocalDay = (a: Date, b: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: DEALERSHIP_TZ }).format(a) ===
    new Intl.DateTimeFormat('en-CA', { timeZone: DEALERSHIP_TZ }).format(b);

  const { data: deliveries } = await admin
    .from('deliveries')
    .select(`
      id, salesperson_id, customer_name, vehicle, delivery_at,
      reminder_24h_sent_at, reminder_9am_sent_at, reminder_2h_sent_at, reminder_at_time_sent_at,
      delivery_requirements(label, status)
    `)
    .in('status', ['new', 'requirements_outstanding', 'ready'])
    .lte('delivery_at', in24h.toISOString())
    .gte('delivery_at', gracePast.toISOString());

  for (const d of deliveries || []) {
    const deliveryAt = new Date(d.delivery_at);
    const outstanding = ((d.delivery_requirements as { label: string; status: string }[]) || [])
      .filter((r) => r.status === 'outstanding')
      .map((r) => r.label);
    const vehicleSuffix = d.vehicle ? ` — ${d.vehicle}` : '';

    if (!d.reminder_24h_sent_at && deliveryAt > now && deliveryAt <= in24h && !isSameLocalDay(deliveryAt, now)) {
      await pushToProfile(
        d.salesperson_id,
        'Delivery Tomorrow',
        `${d.customer_name}${vehicleSuffix}, ${deliveryAt.toLocaleString()}.${todoSuffix(outstanding)}`,
        { url: '/', deliveryId: d.id, type: 'delivery_reminder' },
      );
      await admin.from('deliveries').update({ reminder_24h_sent_at: now.toISOString() }).eq('id', d.id);
    }

    if (!d.reminder_9am_sent_at && deliveryAt > now && isSameLocalDay(deliveryAt, now) && localHour(now) >= 9) {
      await pushToProfile(
        d.salesperson_id,
        'Delivery Today',
        `${d.customer_name}${vehicleSuffix} today at ${deliveryAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. ${ACTION_LINE}${todoSuffix(outstanding)}`,
        { url: '/', deliveryId: d.id, type: 'delivery_today' },
      );
      await admin.from('deliveries').update({ reminder_9am_sent_at: now.toISOString() }).eq('id', d.id);
    }

    if (!d.reminder_2h_sent_at && deliveryAt > now && deliveryAt <= in2h) {
      await pushToProfile(
        d.salesperson_id,
        'Delivery In 2 Hours',
        `${d.customer_name}${vehicleSuffix} at ${deliveryAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. ${ACTION_LINE}${todoSuffix(outstanding)}`,
        { url: '/', deliveryId: d.id, type: 'delivery_2h' },
      );
      await admin.from('deliveries').update({ reminder_2h_sent_at: now.toISOString() }).eq('id', d.id);
    }

    if (!d.reminder_at_time_sent_at && deliveryAt <= now) {
      await pushToProfile(
        d.salesperson_id,
        'Delivery Time',
        `${d.customer_name} is arriving now${vehicleSuffix}. ${ACTION_LINE}${todoSuffix(outstanding)}`,
        { url: '/', deliveryId: d.id, type: 'delivery_time' },
      );
      await admin.from('deliveries').update({ reminder_at_time_sent_at: now.toISOString() }).eq('id', d.id);
    }
  }
}

Deno.cron('delivery-reminders', '*/15 * * * *', async () => {
  await runReminders();
});

// Also callable directly (e.g. for manual testing) via an HTTP request.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  await runReminders();
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
