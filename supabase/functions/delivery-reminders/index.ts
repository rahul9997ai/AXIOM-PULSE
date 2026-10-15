// Scheduled entirely by a pg_cron job (every 15 minutes, calling this over
// HTTP via pg_net) — this function used to also register a Deno.cron at
// module scope, but this project's edge runtime doesn't support Deno.cron
// at all: calling it threw at boot and crashed every single invocation of
// this function from the day it was created, cron-triggered or direct.
// Sends four one-time reminder tiers to the assigned salesperson — 24
// hours before, 9AM the day of, 2 hours before, and at delivery time (the
// most urgent, requireInteraction on the client so it doesn't
// auto-dismiss). After delivery time, if the vehicle still isn't marked
// delivered, an hourly overdue nag repeats — not a one-time tier — until
// it's completed (or the delivery is cancelled), but pauses overnight
// (9PM–9AM Eastern). Once a delivery is 3+ hours overdue, the assigned
// Finance Manager is alerted once, so an unresponsive salesperson isn't
// just quietly pinged forever with no actual consequence.
//
// The same tick also runs the Finance Manager entry check-ins (9AM, 3PM,
// 8PM Eastern) — see runCheckins below.
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
// and worded against Eastern local time. The edge runtime itself runs in
// UTC, so every date shown in a message must pass this zone explicitly.
const DEALERSHIP_TZ = 'America/Toronto';
const HOUR_MS = 60 * 60 * 1000;
const FSM_ESCALATION_HOURS = 3;
const QUIET_HOURS_START = 21; // 9PM local
const QUIET_HOURS_END = 9; // 9AM local

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
      const e = err as { statusCode?: number; message?: string };
      console.error(`[delivery-reminders] push FAIL profile=${profileId} status=${e.statusCode} message=${e.message}`);
      if (e.statusCode === 404 || e.statusCode === 410) stale.push(sub.id);
    }
  }));
  if (stale.length) await admin.from('push_subscriptions').delete().in('id', stale);
}

// The nudge to actually finish the checklist and close out the delivery —
// used on every tier from the day-of onward, once it's actionable today.
const ACTION_LINE = 'Please make sure every delivery requirement is completed, then mark the vehicle delivered.';

function localHour(d: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: DEALERSHIP_TZ, hour: 'numeric', hour12: false }).format(d));
}

function localDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DEALERSHIP_TZ }).format(d);
}

function localDateTime(d: Date): string {
  return d.toLocaleString('en-US', { timeZone: DEALERSHIP_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function localTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { timeZone: DEALERSHIP_TZ, hour: 'numeric', minute: '2-digit' });
}

function isQuietHours(now: Date): boolean {
  const h = localHour(now);
  return h >= QUIET_HOURS_START || h < QUIET_HOURS_END;
}

function hoursOverdue(deliveryAt: Date, now: Date): number {
  return Math.floor((now.getTime() - deliveryAt.getTime()) / HOUR_MS);
}

function hoursLabel(h: number): string {
  return h === 1 ? '1 hour' : `${h} hours`;
}

async function runReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * HOUR_MS);
  const in2h = new Date(now.getTime() + 2 * HOUR_MS);
  const isSameLocalDay = (a: Date, b: Date) => localDateKey(a) === localDateKey(b);

  // No lower bound on delivery_at — an overdue delivery needs its hourly
  // nudge no matter how long ago it was scheduled, not just within some
  // recent window. The status filter already keeps this to genuinely
  // unfinished work, which in practice doesn't pile up indefinitely.
  const { data: deliveries, error } = await admin
    .from('deliveries')
    .select(`
      id, salesperson_id, salesperson_name, fsm_id, customer_name, vehicle, delivery_at,
      reminder_24h_sent_at, reminder_9am_sent_at, reminder_2h_sent_at, reminder_at_time_sent_at,
      last_overdue_reminder_at, fsm_escalation_sent_at
    `)
    .in('status', ['new', 'requirements_outstanding', 'ready'])
    .lte('delivery_at', in24h.toISOString());
  if (error) console.error(`[delivery-reminders] query failed: ${error.message}`);

  const quiet = isQuietHours(now);

  for (const d of deliveries || []) {
    const deliveryAt = new Date(d.delivery_at);
    const vehicleSuffix = d.vehicle ? ` — ${d.vehicle}` : '';

    if (!d.reminder_24h_sent_at && deliveryAt > now && deliveryAt <= in24h && !isSameLocalDay(deliveryAt, now)) {
      await pushToProfile(
        d.salesperson_id,
        'Delivery Tomorrow',
        `${d.customer_name}${vehicleSuffix}, ${localDateTime(deliveryAt)}.`,
        { url: `/delivery/${d.id}`, deliveryId: d.id, type: 'delivery_reminder' },
      );
      await admin.from('deliveries').update({ reminder_24h_sent_at: now.toISOString() }).eq('id', d.id);
    }

    if (!d.reminder_9am_sent_at && deliveryAt > now && isSameLocalDay(deliveryAt, now) && localHour(now) >= 9) {
      await pushToProfile(
        d.salesperson_id,
        'Delivery Today',
        `${d.customer_name}${vehicleSuffix} today at ${localTime(deliveryAt)}. ${ACTION_LINE}`,
        { url: `/delivery/${d.id}`, deliveryId: d.id, type: 'delivery_today' },
      );
      await admin.from('deliveries').update({ reminder_9am_sent_at: now.toISOString() }).eq('id', d.id);
    }

    if (!d.reminder_2h_sent_at && deliveryAt > now && deliveryAt <= in2h) {
      await pushToProfile(
        d.salesperson_id,
        '2 Hours To Go',
        `2 hrs to go for ${d.customer_name}${vehicleSuffix} — make sure the car is delivery ready and the plates are put on.`,
        { url: `/delivery/${d.id}`, deliveryId: d.id, type: 'delivery_2h' },
      );
      await admin.from('deliveries').update({ reminder_2h_sent_at: now.toISOString() }).eq('id', d.id);
    }

    if (!d.reminder_at_time_sent_at && deliveryAt <= now) {
      await pushToProfile(
        d.salesperson_id,
        'Delivery Time',
        `${d.customer_name} is arriving now${vehicleSuffix}. ${ACTION_LINE}`,
        { url: `/delivery/${d.id}`, deliveryId: d.id, type: 'delivery_time' },
      );
      await admin.from('deliveries').update({ reminder_at_time_sent_at: now.toISOString() }).eq('id', d.id);
    }

    // Overdue: starts 1 hour after delivery_at, repeats every hour — not a
    // one-time tier like the others — until the delivery is marked
    // delivered (or cancelled, which drops it out of the status filter
    // above entirely). Paused entirely during quiet hours: skipped without
    // updating last_overdue_reminder_at, so the very next eligible tick
    // once quiet hours end fires right away. Gated on the at-time reminder
    // having already fired so it never doubles up with it in one tick.
    if (quiet) continue;

    const overdueHours = hoursOverdue(deliveryAt, now);
    if (d.reminder_at_time_sent_at && overdueHours >= 1) {
      const lastSent = d.last_overdue_reminder_at ? new Date(d.last_overdue_reminder_at) : null;
      const dueForAnother = !lastSent || now.getTime() - lastSent.getTime() >= HOUR_MS;
      if (dueForAnother) {
        const escalated = overdueHours >= FSM_ESCALATION_HOURS;
        await pushToProfile(
          d.salesperson_id,
          escalated ? 'OVERDUE — Manager Notified' : 'OVERDUE — Action Required',
          escalated
            ? `${d.customer_name}${vehicleSuffix} is now ${hoursLabel(overdueHours)} overdue. Your Finance Manager has been notified. Mark it delivered now.`
            : `${d.customer_name}${vehicleSuffix} was due ${hoursLabel(overdueHours)} ago. This is overdue — complete it immediately.`,
          { url: `/delivery/${d.id}`, deliveryId: d.id, type: 'delivery_overdue' },
        );
        await admin.from('deliveries').update({ last_overdue_reminder_at: now.toISOString() }).eq('id', d.id);
      }

      // Fires once, the first tick past the escalation threshold — the FSM
      // gets one clear alert, not the salesperson's hourly flood.
      if (overdueHours >= FSM_ESCALATION_HOURS && !d.fsm_escalation_sent_at && d.fsm_id) {
        await pushToProfile(
          d.fsm_id,
          'Overdue Delivery — Needs Follow-Up',
          `${d.salesperson_name ?? 'A salesperson'}'s delivery for ${d.customer_name}${vehicleSuffix} is ${hoursLabel(overdueHours)} overdue and still not marked delivered. Please follow up with them directly.`,
          { url: `/delivery/${d.id}`, deliveryId: d.id, type: 'urgent' },
        );
        await admin.from('deliveries').update({ fsm_escalation_sent_at: now.toISOString() }).eq('id', d.id);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Email, sent through Resend alongside the check-in push. Optional: until
// RESEND_API_KEY and EMAIL_FROM are set as function secrets this is a
// no-op, so push keeps working on its own.
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const EMAIL_FROM = Deno.env.get('EMAIL_FROM'); // e.g. 'Axiom Pulse <pulse@rahulchamp.ca>'
const APP_URL = 'https://pulse.rahulchamp.ca';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendEmail(to: string | null | undefined, subject: string, heading: string, body: string, ctaLabel: string, ctaPath: string) {
  if (!RESEND_API_KEY || !EMAIL_FROM || !to) return;
  const html = `<!doctype html><html><body style="margin:0;background:#eef1f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dbe2ea">
      <tr><td style="background:#1e3a8a;padding:16px 22px;color:#ffffff;font-size:17px;font-weight:800;letter-spacing:.04em">AXIOM <span style="font-style:italic;font-weight:700;color:#bcd0ff">Pulse</span></td></tr>
      <tr><td style="padding:22px">
        <div style="font-size:19px;font-weight:800;margin:0 0 10px">${escapeHtml(heading)}</div>
        <div style="font-size:15px;line-height:1.55;color:#334155;margin:0 0 20px">${escapeHtml(body)}</div>
        <a href="${APP_URL}${ctaPath}" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 20px;border-radius:10px">${escapeHtml(ctaLabel)}</a>
      </td></tr>
      <tr><td style="padding:14px 22px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">Sent by Axiom Pulse · The Pulse of Every Delivery.</td></tr>
    </table>
  </td></tr></table></body></html>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, text: `${heading}\n\n${body}\n\n${ctaLabel}: ${APP_URL}${ctaPath}` }),
    });
    if (!res.ok) console.error(`[delivery-reminders] email FAIL to=${to} status=${res.status} body=${await res.text()}`);
  } catch (e) {
    console.error(`[delivery-reminders] email FAIL to=${to} message=${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Finance Manager entry check-ins. Three times a day every active FSM is
// asked to confirm that every work order they've sent in CDK is entered in
// Pulse. Each check-in is a row in fsm_checkins (unique per FSM/day/slot,
// which is what keeps a 15-minute tick from sending it twice). One
// follow-up goes out an hour later if it's still unconfirmed; anything
// left unconfirmed by the next morning is reported to the dealership's
// GMs and the Master Administrators.

const CHECKIN_SLOTS = [
  { slot: '9am', hour: 9, label: '9:00 AM' },
  { slot: '3pm', hour: 15, label: '3:00 PM' },
  { slot: '8pm', hour: 20, label: '8:00 PM' },
] as const;
// A slot is only sent within this many hours of its time, so a late or
// missed tick never fires a stale check-in (e.g. the 9AM one at 2PM).
const CHECKIN_SEND_WINDOW_HOURS = 2;

function checkinMessage(slot: string, enteredToday: number): { title: string; body: string } {
  const entered = enteredToday === 0
    ? 'You have entered no deliveries in Pulse today.'
    : `You have entered ${enteredToday} deliver${enteredToday === 1 ? 'y' : 'ies'} in Pulse today.`;
  if (slot === '9am') {
    return {
      title: 'Morning Check-in — Deliveries',
      body: 'Good morning. Confirm that every work order sent in CDK since your last check-in has been entered in Pulse. Tap to confirm.',
    };
  }
  if (slot === '3pm') {
    return {
      title: 'Afternoon Check-in — Deliveries',
      body: `Confirm that every work order you have sent in CDK today has been entered in Pulse. ${entered} Tap to confirm.`,
    };
  }
  return {
    title: 'End-of-Day Check-in — Required',
    body: `Before you finish for the day, confirm that every work order sent in CDK today has been entered in Pulse. ${entered} Unconfirmed check-ins are reported to management.`,
  };
}

// Offset of Eastern time from UTC at the given instant, in ms (negative in
// Toronto) — used to turn a local midnight into the matching UTC instant.
function tzOffsetMs(d: Date): number {
  const local = new Date(d.toLocaleString('en-US', { timeZone: DEALERSHIP_TZ }));
  const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  return local.getTime() - utc.getTime();
}

async function runCheckins() {
  const now = new Date();
  const hour = localHour(now);
  const today = localDateKey(now);
  const current = CHECKIN_SLOTS.find((s) => hour >= s.hour && hour < s.hour + CHECKIN_SEND_WINDOW_HOURS);

  if (current) {
    const { data: fsms } = await admin
      .from('profiles')
      .select('id, dealership_id, email')
      .eq('role', 'FSM')
      .eq('pulse_enabled', true)
      .eq('active', true);

    const midnightUtc = new Date(`${today}T00:00:00Z`);
    const localMidnight = new Date(midnightUtc.getTime() - tzOffsetMs(midnightUtc));

    for (const f of fsms || []) {
      // Insert-first: only the tick that actually creates the row sends it.
      const { data: created } = await admin
        .from('fsm_checkins')
        .upsert(
          { fsm_id: f.id, dealership_id: f.dealership_id, local_date: today, slot: current.slot },
          { onConflict: 'fsm_id,local_date,slot', ignoreDuplicates: true },
        )
        .select('id');
      const row = created?.[0];
      if (!row) continue;

      const { count } = await admin
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('fsm_id', f.id)
        .gte('created_at', localMidnight.toISOString());
      const { title, body } = checkinMessage(current.slot, count ?? 0);
      await pushToProfile(f.id, title, body, { url: `/checkin/${row.id}`, type: 'checkin' });
      await sendEmail(f.email, title, title, body.replace(' Tap to confirm.', ''), 'Confirm in Pulse', `/checkin/${row.id}`);
    }
  }

  if (isQuietHours(now)) return;

  // One follow-up an hour after any check-in still unconfirmed today.
  const { data: dueReminders } = await admin
    .from('fsm_checkins')
    .select('id, fsm_id, slot')
    .eq('local_date', today)
    .is('confirmed_at', null)
    .is('reminder_sent_at', null)
    .lte('sent_at', new Date(now.getTime() - HOUR_MS).toISOString());
  for (const c of dueReminders || []) {
    const label = CHECKIN_SLOTS.find((s) => s.slot === c.slot)?.label ?? c.slot;
    await pushToProfile(
      c.fsm_id,
      'Check-in Still Unconfirmed',
      `Your ${label} delivery check-in has not been confirmed. Enter any outstanding deliveries in Pulse and confirm now — unconfirmed check-ins are reported to management.`,
      { url: `/checkin/${c.id}`, type: 'checkin' },
    );
    await admin.from('fsm_checkins').update({ reminder_sent_at: now.toISOString() }).eq('id', c.id);
  }

  // Morning report: anything from a previous day never confirmed goes to the
  // dealership's GMs and to every Master Administrator, once.
  const { data: missed } = await admin
    .from('fsm_checkins')
    .select('id, fsm_id, dealership_id, local_date, slot')
    .lt('local_date', today)
    .is('confirmed_at', null)
    .is('escalated_at', null);
  if (!missed?.length) return;

  const { data: names } = await admin.from('profiles').select('id, name').in('id', [...new Set(missed.map((m) => m.fsm_id))]);
  const nameOf = new Map((names || []).map((n) => [n.id, n.name as string]));
  const { data: masters } = await admin.from('profiles').select('id').eq('role', 'Master Administrator').eq('pulse_enabled', true);

  const byDealership = new Map<string, typeof missed>();
  missed.forEach((m) => byDealership.set(m.dealership_id ?? '', [...(byDealership.get(m.dealership_id ?? '') ?? []), m]));

  for (const [dealershipId, rows] of byDealership) {
    const multiDay = new Set(rows.map((r) => r.local_date)).size > 1;
    const byFsm = new Map<string, string[]>();
    rows
      .sort((a, b) => a.local_date.localeCompare(b.local_date)
        || CHECKIN_SLOTS.findIndex((s) => s.slot === a.slot) - CHECKIN_SLOTS.findIndex((s) => s.slot === b.slot))
      .forEach((r) => {
        const name = nameOf.get(r.fsm_id) ?? 'A Finance Manager';
        const label = CHECKIN_SLOTS.find((s) => s.slot === r.slot)?.label ?? r.slot;
        const when = multiDay
          ? `${new Date(`${r.local_date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} ${label}`
          : label;
        byFsm.set(name, [...(byFsm.get(name) ?? []), when]);
      });
    const summary = Array.from(byFsm.entries()).map(([name, slots]) => `${name} missed ${slots.join(', ')}`).join('. ');

    const { data: gms } = await admin.from('profiles').select('id')
      .eq('role', 'General Manager').eq('dealership_id', dealershipId).eq('pulse_enabled', true);
    const recipients = new Set([...(gms || []).map((g) => g.id), ...(masters || []).map((m) => m.id)]);
    for (const id of recipients) {
      await pushToProfile(
        id,
        multiDay ? 'Missed Delivery Check-ins' : 'Missed Delivery Check-ins — Yesterday',
        `${summary}. See Settings → Delivery check-ins for the full log.`,
        { url: '/settings', type: 'checkin_report' },
      );
    }
    await admin.from('fsm_checkins').update({ escalated_at: now.toISOString() }).in('id', rows.map((r) => r.id));
  }
}

// Called by the pg_cron job via HTTP. Also safe to call directly for
// manual testing.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  await runReminders();
  await runCheckins().catch((e) => console.error(`[delivery-reminders] checkins failed: ${(e as Error).message}`));
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
