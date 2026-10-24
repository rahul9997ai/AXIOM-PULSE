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
// The same tick also sends the Finance Managers' daily reminder to enter
// their deliveries (push and email, on a schedule the GM sets) — see
// runFsmReminders below — and, once a delivery is marked delivered, emails
// the salesperson a ready-to-send customer thank-you (runThankYous).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { reminderEmailHtml, reminderEmailSubject, reminderEmailText } from './reminderEmail.ts';
import { lienEmailHtml, lienEmailSubject, lienEmailText } from './lienReminderEmail.ts';
import { testEmailHtml, thankYouEmailHtml, thankYouEmailSubject, thankYouEmailText, type ThankYouInput } from './thankYouEmail.ts';

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
// Email, sent through Resend. Optional: until
// RESEND_API_KEY and EMAIL_FROM are set as function secrets this is a
// no-op, so push keeps working on its own.
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
// The sending address comes from the EMAIL_FROM secret; the display name is
// always the product name, whatever name the secret was saved with.
const EMAIL_FROM_RAW = Deno.env.get('EMAIL_FROM'); // e.g. 'Mahanex Pulse <no-reply@rahulchamp.ca>'
const EMAIL_FROM = EMAIL_FROM_RAW
  ? `Mahanex Pulse <${EMAIL_FROM_RAW.match(/<([^>]+)>/)?.[1] ?? EMAIL_FROM_RAW.trim()}>`
  : undefined;
const APP_URL = 'https://pulse.rahulchamp.ca';

// Optional third channel: a Telegram message, for people who connected the bot.
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
async function sendTelegram(chatId: number | null | undefined, text: string, buttonLabel: string, url: string) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: { inline_keyboard: [[{ text: buttonLabel, url }]] } }),
    });
    if (!res.ok) console.error(`[delivery-reminders] telegram FAIL chat=${chatId} status=${res.status} body=${await res.text()}`);
  } catch (e) {
    console.error(`[delivery-reminders] telegram FAIL chat=${chatId} message=${(e as Error).message}`);
  }
}

async function sendRawEmail(to: string | null | undefined, subject: string, html: string, text: string) {
  if (!RESEND_API_KEY || !EMAIL_FROM || !to) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, text }),
    });
    if (!res.ok) { console.error(`[delivery-reminders] email FAIL to=${to} status=${res.status} body=${await res.text()}`); return false; }
    return true;
  } catch (e) {
    console.error(`[delivery-reminders] email FAIL to=${to} message=${(e as Error).message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Finance Manager daily reminders to enter the day's deliveries: a short,
// personal push (default 3 PM) and one fuller email (default 4 PM), each
// Monday to Saturday by default. The GM sets, per dealership and per
// channel, whether it's on, the time, the weekdays and which Finance
// Managers receive it (fsm_reminder_settings). fsm_reminder_log keeps each
// person to one send per channel per day.

type Channel = 'push' | 'email';

interface ReminderSetting {
  dealership_id: string;
  channel: Channel;
  enabled: boolean;
  send_time: string; // 'HH:MM:SS'
  days: number[]; // ISO weekdays, 1 = Monday
  excluded_ids: string[];
}

const DEFAULT_SETTINGS: Record<Channel, Omit<ReminderSetting, 'dealership_id' | 'channel'>> = {
  push: { enabled: true, send_time: '15:00:00', days: [1, 2, 3, 4, 5, 6], excluded_ids: [] },
  email: { enabled: true, send_time: '16:00:00', days: [1, 2, 3, 4, 5, 6], excluded_ids: [] },
};
// A reminder is only sent within this long after its time, so a missed
// tick or a schedule change never fires a stale one hours later.
const REMINDER_SEND_WINDOW_MIN = 120;

function localMinutes(d: Date): number {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: DEALERSHIP_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d).split(':').map(Number);
  return (h % 24) * 60 + m;
}

function localIsoWeekday(d: Date): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: DEALERSHIP_TZ, weekday: 'short' }).format(d);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name) + 1;
}

function greeting(minutes: number): string {
  if (minutes < 12 * 60) return 'Good morning';
  if (minutes < 17 * 60) return 'Good afternoon';
  return 'Good evening';
}

// Offset of Eastern time from UTC at the given instant, in ms (negative in
// Toronto) — used to turn a local midnight into the matching UTC instant.
function tzOffsetMs(d: Date): number {
  const local = new Date(d.toLocaleString('en-US', { timeZone: DEALERSHIP_TZ }));
  const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  return local.getTime() - utc.getTime();
}

async function runFsmReminders() {
  const now = new Date();
  const today = localDateKey(now);
  const minutes = localMinutes(now);
  const weekday = localIsoWeekday(now);

  const [{ data: dealerships }, { data: stored }] = await Promise.all([
    admin.from('dealerships').select('id, name'),
    admin.from('fsm_reminder_settings').select('*'),
  ]);

  const due: { dealershipId: string; dealershipName: string; setting: ReminderSetting }[] = [];
  for (const d of dealerships || []) {
    for (const channel of ['push', 'email'] as Channel[]) {
      const row = (stored || []).find((s) => s.dealership_id === String(d.id) && s.channel === channel);
      const setting: ReminderSetting = { dealership_id: String(d.id), channel, ...DEFAULT_SETTINGS[channel], ...(row ?? {}) };
      if (!setting.enabled || !setting.days.includes(weekday)) continue;
      const [h, m] = setting.send_time.split(':').map(Number);
      const start = h * 60 + m;
      if (minutes < start || minutes >= start + REMINDER_SEND_WINDOW_MIN) continue;
      due.push({ dealershipId: String(d.id), dealershipName: d.name as string, setting });
    }
  }
  if (!due.length) return;

  const midnightUtc = new Date(`${today}T00:00:00Z`);
  const localMidnight = new Date(midnightUtc.getTime() - tzOffsetMs(midnightUtc));
  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  for (const { dealershipId, dealershipName, setting } of due) {
    const { data: fsms } = await admin
      .from('profiles')
      .select('id, name, email, notify_email')
      .eq('role', 'FSM')
      .eq('dealership_id', dealershipId)
      .eq('pulse_enabled', true)
      .eq('active', true);

    for (const f of (fsms || []).filter((p) => !setting.excluded_ids.includes(p.id))) {
      // Insert-first: only the tick that creates the log row sends it.
      const { data: logged } = await admin
        .from('fsm_reminder_log')
        .upsert({ profile_id: f.id, channel: setting.channel, local_date: today }, { onConflict: 'profile_id,channel,local_date', ignoreDuplicates: true })
        .select('profile_id');
      if (!logged?.length) continue;

      const firstName = String(f.name || 'there').split(' ')[0];
      if (setting.channel === 'push') {
        await pushToProfile(
          f.id,
          `${greeting(minutes)}, ${firstName}`,
          'A quick reminder to enter any deliveries from today\'s CDK 180 work orders that aren\'t in Pulse yet — it keeps delivery tracking accurate and gives the team time to complete every requirement.',
          { url: '/new', type: 'fsm_reminder' },
        );
      } else {
        const { data: entries } = await admin
          .from('deliveries')
          .select('customer_name, stock_number, delivery_at, created_at')
          .eq('fsm_id', f.id)
          .gte('created_at', localMidnight.toISOString())
          .order('created_at', { ascending: true });
        const input = {
          firstName,
          dealershipName,
          dateLabel,
          entries: entries || [],
          newDeliveryUrl: `${APP_URL}/new`,
          timeZone: DEALERSHIP_TZ,
        };
        await sendRawEmail(f.notify_email ?? f.email, reminderEmailSubject(), reminderEmailHtml(input), reminderEmailText(input));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Customer thank-you emails. When a delivery is marked delivered, its
// salesperson is emailed a ready-to-send thank-you for the customer (survey
// version for new vehicles, Google review + referral version for used) to
// send from their own work email. Needs the salesperson's notification email
// (profiles.notify_email); a delivery is picked up for THANKYOU_WINDOW_HOURS
// after it's delivered, so one added a little later still gets it.
// thankyou_log keeps it to one email per delivery.

const THANKYOU_WINDOW_HOURS = 72;

// Placeholder sign-in addresses that can't receive mail.
const deliverable = (email: string | null | undefined) => (email && !/@pulse\.local$/i.test(email) ? email : null);

async function runThankYous() {
  const since = new Date(Date.now() - THANKYOU_WINDOW_HOURS * HOUR_MS).toISOString();
  const { data: delivered } = await admin
    .from('deliveries')
    .select('id, dealership_id, salesperson_id, salesperson_name, customer_name, vehicle, vehicle_condition')
    .eq('status', 'delivered')
    .gte('delivered_at', since);
  if (!delivered?.length) return;

  const { data: done } = await admin.from('thankyou_log').select('delivery_id').in('delivery_id', delivered.map((d) => d.id));
  const pending = delivered.filter((d) => !(done || []).some((l) => l.delivery_id === d.id));
  if (!pending.length) return;

  const dealershipIds = [...new Set(pending.map((d) => String(d.dealership_id)))];
  const [{ data: dealerships }, { data: settings }, { data: people }] = await Promise.all([
    admin.from('dealerships').select('id, name, data').in('id', dealershipIds),
    admin.from('thankyou_settings').select('*').in('dealership_id', dealershipIds),
    admin.from('profiles').select('id, name, email, notify_email').in('id', [...new Set(pending.map((d) => d.salesperson_id))]),
  ]);

  for (const d of pending) {
    const setting = (settings || []).find((s) => s.dealership_id === String(d.dealership_id));
    if (setting && !setting.enabled) continue;
    const person = (people || []).find((p) => p.id === d.salesperson_id);
    const to = deliverable(person?.notify_email) ?? deliverable(person?.email);
    if (!to) continue;
    const dealership = (dealerships || []).find((x) => String(x.id) === String(d.dealership_id));
    const data = (dealership?.data ?? {}) as Record<string, string | undefined>;

    // Insert-first: only the tick that creates the log row sends it.
    const { data: logged } = await admin
      .from('thankyou_log')
      .upsert({ delivery_id: d.id, sent_to: to }, { onConflict: 'delivery_id', ignoreDuplicates: true })
      .select('delivery_id');
    if (!logged?.length) continue;

    const input: ThankYouInput = {
      customerName: d.customer_name,
      vehicle: d.vehicle,
      condition: d.vehicle_condition,
      salespersonName: person?.name || d.salesperson_name || 'Your salesperson',
      dealership: {
        name: dealership?.name ?? data.name ?? '',
        address: data.address,
        city: data.city,
        phone: data.phone,
        brandKey: data.brandKey,
        brandColor: data.brandColor,
        googleReviewUrl: setting?.google_review_url,
      },
    };
    const sent = await sendRawEmail(to, thankYouEmailSubject(input), thankYouEmailHtml(input, `${APP_URL}/delivery/${d.id}`), thankYouEmailText(input));
    // Not sent (e.g. a temporary email failure) — let a later tick retry.
    if (!sent) await admin.from('thankyou_log').delete().eq('delivery_id', d.id);
  }
}

// ---------------------------------------------------------------------------
// Trade-in lien payoff: when a finance manager said "yes, there's a lien",
// they get 3 reminders (push + email) after the delivery is delivered —
// 2 hours after, 9 AM the next day, and 9 AM three days after. They stop
// the moment the lien is marked paid (or "no lien after all").

const LIEN_MAX_REMINDERS = 3;
const LIEN_MIN_GAP_HOURS = 6;
const LIEN_WINDOW_DAYS = 30;

// 9:00 AM local, `days` calendar days after the local date of `from`.
function lienNineAm(from: Date, days: number): Date {
  const [y, m, d] = localDateKey(from).split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d + days, 9);
  return new Date(guess - tzOffsetMs(new Date(guess + 4 * HOUR_MS)));
}

function lienDueAt(deliveredAt: Date, sent: number): Date {
  if (sent === 0) return new Date(deliveredAt.getTime() + 2 * HOUR_MS);
  return lienNineAm(deliveredAt, sent === 1 ? 1 : 3);
}

async function runLienReminders() {
  const now = new Date();
  if (isQuietHours(now)) return;
  const since = new Date(now.getTime() - LIEN_WINDOW_DAYS * 24 * HOUR_MS).toISOString();
  const { data: rows } = await admin
    .from('deliveries')
    .select('id, fsm_id, customer_name, stock_number, vehicle, delivered_at, lien_reminders_sent, lien_last_reminder_at')
    .eq('status', 'delivered')
    .eq('lien_status', 'pending')
    .lt('lien_reminders_sent', LIEN_MAX_REMINDERS)
    .gte('delivered_at', since);
  if (!rows?.length) return;

  const { data: people } = await admin.from('profiles').select('id, name, email, notify_email, telegram_chat_id').in('id', [...new Set(rows.map((r) => r.fsm_id))]);

  for (const r of rows) {
    const sent = Number(r.lien_reminders_sent);
    const deliveredAt = new Date(r.delivered_at);
    if (now < lienDueAt(deliveredAt, sent)) continue;
    if (r.lien_last_reminder_at && now.getTime() - new Date(r.lien_last_reminder_at).getTime() < LIEN_MIN_GAP_HOURS * HOUR_MS) continue;

    // Claim this reminder first so overlapping ticks can't double-send.
    const { data: claimed } = await admin
      .from('deliveries')
      .update({ lien_reminders_sent: sent + 1, lien_last_reminder_at: now.toISOString() })
      .eq('id', r.id).eq('lien_reminders_sent', sent).eq('lien_status', 'pending')
      .select('id');
    if (!claimed?.length) continue;

    const n = (sent + 1) as 1 | 2 | 3;
    const person = (people || []).find((p) => p.id === r.fsm_id);
    const url = `${APP_URL}/delivery/${r.id}`;
    const title = `Lien reminder ${n} of 3`;
    const body = n === 3
      ? `Final reminder: pay off the lien on ${r.customer_name}'s trade-in.`
      : n === 2
        ? `The lien on ${r.customer_name}'s trade-in is still open.`
        : `Don't forget to pay off the lien on ${r.customer_name}'s trade-in.`;
    await pushToProfile(r.fsm_id, title, body, { url: `/delivery/${r.id}`, type: 'lien_reminder' });
    await sendTelegram(person?.telegram_chat_id, `${title}\n${body}\nTap "Lien paid off" in Pulse once it's done to stop these reminders.`, 'Open delivery', url);
    const to = deliverable(person?.notify_email) ?? deliverable(person?.email);
    const input = {
      firstName: (person?.name ?? '').split(' ')[0] || 'there',
      customerName: r.customer_name,
      stockNumber: r.stock_number,
      vehicle: r.vehicle,
      deliveredLabel: localDateTime(deliveredAt),
      n,
      url,
    };
    await sendRawEmail(to, lienEmailSubject(input), lienEmailHtml(input), lienEmailText(input));
  }
}

// Sends a signed-in person a test email at their notification address, so
// a typo is caught the moment they save it.
async function sendTestEmail(req: Request): Promise<Response> {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const { data: { user } } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  if (!user) return json({ error: 'Not signed in' }, 401);
  const { data: me } = await admin.from('profiles').select('name, notify_email').eq('id', user.id).single();
  const to = deliverable(me?.notify_email);
  if (!to) return json({ error: 'Save your email first' }, 400);
  const sent = await sendRawEmail(to, 'Your email is connected to Mahanex Pulse', testEmailHtml(me?.name ?? ''), `You're all set. ${to} is now connected to Mahanex Pulse — customer thank-you emails and other Pulse notifications will arrive here.`);
  return sent ? json({ ok: true, to }) : json({ error: 'The email couldn\'t be sent — check the address and try again.' }, 502);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Called by the pg_cron job via HTTP. Also safe to call directly for
// manual testing. The app calls it with { action: 'test_email' } instead.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({}));
  if (body?.action === 'test_email') return sendTestEmail(req);
  await runReminders();
  await runFsmReminders().catch((e) => console.error(`[delivery-reminders] FSM reminders failed: ${(e as Error).message}`));
  await runLienReminders().catch((e) => console.error(`[delivery-reminders] lien reminders failed: ${(e as Error).message}`));
  await runThankYous().catch((e) => console.error(`[delivery-reminders] thank-yous failed: ${(e as Error).message}`));
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
