# AXIOM Pulse

Installable PWA for automotive delivery coordination — the pulse of every delivery.
Sends background push notifications (works even when the app is fully closed).

**This is a rebuild.** The `web/` directory is the new, production-track app. The
files at repo root (`index.html`, `pwa/`, `app/`, `proof*.html`, etc.) are the
original raw prototype, kept for reference only — not used by the new build.

## Architecture

- **Frontend**: `web/` — Vite + React + TypeScript PWA, installable via manifest +
  service worker (`vite-plugin-pwa`, injectManifest strategy — no HTML string
  patching, unlike the old service worker).
- **Backend**: shared with Axiom Command Center. **No separate Supabase project.**
  Pulse's tables (`deliveries`, `delivery_requirements`, `push_subscriptions`) live
  in the existing `Axiom` Supabase project (`tbptlrewwxhggxxfdiks`), reusing its
  `profiles` / `dealerships` tables and role system. This avoids ever needing a
  3rd active Supabase project.
- **Push**: Web Push (VAPID) via two edge functions deployed to the Axiom project:
  `register-webpush` (saves a device's push subscription) and `send-webpush`
  (sends a notification to a profile's devices; also used for the in-app test button).
- **Deploy target**: its own static site/subdomain, e.g. `pulse.rahulchamp.ca`,
  separate from Command Center's `finance.rahulchamp.ca` — installability and push
  are scoped per-origin, so each is a distinct installable app on the phone even
  though they share one database.

## Roles

- **Master Administrator / General Manager / FSM** — create deliveries, assign a
  salesperson, set collection requirements (void cheque, trade release, ownership,
  refund due, money due, custom notes).
- **Salesperson** — sees only their assigned deliveries, enables push notifications,
  can't mark a delivery "delivered" while requirements are outstanding.

## Local development

```
cd web
cp .env.example .env
npm install
npm run dev
```

`.env.example` already has the Axiom project URL, anon key, and the VAPID public key.

## Edge function secrets (one-time, Supabase dashboard or CLI)

`send-webpush` needs the VAPID keypair as function secrets on the Axiom project.
The public key is safe to keep in `.env.example`; the **private key is not stored
anywhere in this repo** — it was generated once and handed to you directly in
chat. Set both via the Supabase dashboard (Project Settings → Edge Functions →
Secrets) or the CLI:

```
supabase secrets set --project-ref tbptlrewwxhggxxfdiks \
  VAPID_PUBLIC_KEY=<see web/.env.example> \
  VAPID_PRIVATE_KEY=<the private key from chat — do not commit it>
```

If the private key is ever lost, generate a fresh VAPID keypair and update both
the secret and `VITE_VAPID_PUBLIC_KEY` in `.env` — existing push subscriptions
will need to re-subscribe.

## Known follow-ups

- App icon is currently SVG-only (`web/public/icons/icon.svg`); generate proper
  192×192 / 512×512 PNGs (e.g. `npx pwa-asset-generator`) for best iOS home-screen
  icon fidelity.
- No scheduled reminder job yet — `send-webpush` can be called on demand (e.g. the
  in-app "send test notification" button); a cron-triggered edge function or
  `pg_cron` job to fire reminders ahead of `delivery_at` is the next backend piece.
- Existing `profiles.role` values in the Axiom project are `FSM`, `General Manager`,
  `Master Administrator`. Any user who should see the salesperson view needs
  `role = 'Salesperson'` set explicitly — no such profiles exist yet, so create/edit
  one to test that path end-to-end.
- Old prototype's Supabase project (`AXIOM PULSE`, paused) is no longer needed by
  this build; safe to leave paused or delete once this is verified in production.
