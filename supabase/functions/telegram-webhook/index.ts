// Telegram bot webhook. Telegram calls this when someone messages the bot;
// "/start <code>" links that Telegram chat to the Pulse profile that made the
// code. Deployed with verify_jwt = false and protected by Telegram's secret
// header instead.
//
//   GET                       -> { username }  (the app builds the t.me link)
//   GET ?register=<secret>    -> points the bot's webhook at this function
import { createClient } from 'jsr:@supabase/supabase-js@2';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const api = (method: string, body?: unknown) =>
  fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const say = (chat_id: number, text: string) => api('sendMessage', { chat_id, text });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!TOKEN || !SECRET) return json({ error: 'Telegram is not configured' }, 503);
  const url = new URL(req.url);

  if (req.method === 'GET') {
    if (url.searchParams.get('register') === SECRET) {
      const res = await api('setWebhook', { url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-webhook`, secret_token: SECRET, allowed_updates: ['message'] });
      return json(await res.json());
    }
    const me = await (await api('getMe')).json();
    return json({ username: me?.result?.username ?? null });
  }

  if (req.headers.get('x-telegram-bot-api-secret-token') !== SECRET) return json({ error: 'forbidden' }, 403);
  const update = await req.json().catch(() => null);
  const msg = update?.message;
  const chatId: number | undefined = msg?.chat?.id;
  const text: string = (msg?.text ?? '').trim();
  if (!chatId || msg?.chat?.type !== 'private') return json({ ok: true });

  if (/^\/stop\b/i.test(text)) {
    await admin.from('profiles').update({ telegram_chat_id: null }).eq('telegram_chat_id', chatId);
    await say(chatId, 'Disconnected. You will no longer get Pulse reminders here.');
    return json({ ok: true });
  }

  const code = text.match(/^\/start\s+([a-f0-9]{10,})$/i)?.[1];
  if (!code) {
    await say(chatId, 'To connect, open Pulse → Settings → Telegram and tap "Connect Telegram".');
    return json({ ok: true });
  }
  const { data: linked } = await admin.from('profiles')
    .update({ telegram_chat_id: chatId, telegram_link_code: null, telegram_link_expires: null })
    .eq('telegram_link_code', code).gt('telegram_link_expires', new Date().toISOString())
    .select('name');
  if (!linked?.length) {
    await say(chatId, 'That link has expired. Go back to Pulse → Settings and tap "Connect Telegram" again.');
  } else {
    await say(chatId, `✓ Connected, ${String(linked[0].name).split(' ')[0]}. Pulse will send your trade-in lien reminders here. Send /stop any time to disconnect.`);
  }
  return json({ ok: true });
});
