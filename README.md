# AXIOM Pulse

Real-time dealership delivery coordination platform: it takes the information
completed by the FSM and turns it into a structured, actionable, trackable
delivery workflow for the salesperson. Installable PWA, background push
notifications that work even when the app is fully closed.

**This is a rebuild.** The `web/` directory is the new, production-track app. The
files at repo root (`index.html`, `pwa/`, `app/`, `proof*.html`, etc.) are the
original raw prototype, kept for reference only — not used by the new build.

## Architecture

- **Frontend**: `web/` — Vite + React + TypeScript PWA, installable via manifest +
  service worker (`vite-plugin-pwa`, injectManifest strategy — no HTML string
  patching, unlike the old service worker).
- **Backend**: shared with Axiom Command Center — a module inside it, not a
  separate app. **No separate Supabase project.** Pulse's tables (`deliveries`,
  `delivery_requirements`, `delivery_events`, `push_subscriptions`) live in the
  existing `Axiom` Supabase project (`tbptlrewwxhggxxfdiks`), reusing its
  `profiles` / `dealerships` tables and role system rather than duplicating them.
  This avoids ever needing a 3rd active Supabase project.
- **Realtime**: `deliveries` and `delivery_requirements` are published to
  Supabase Realtime. The FSM sees salesperson progress live; the salesperson
  sees FSM edits live. No polling.
- **Push**: Web Push (VAPID) via edge functions on the Axiom project:
  `register-webpush` (saves a device's push subscription), `send-webpush`
  (sends to a profile's devices — used for "new delivery assigned" and the
  in-app test button; a manager can notify other profiles in their own
  dealership, anyone can notify only themselves), and `delivery-reminders`
  (a `Deno.cron` job, runs hourly, sends the day-before and delivery-day
  reminders once each per delivery).
- **Deploy target**: its own static site/subdomain, e.g. `pulse.rahulchamp.ca`,
  separate from Command Center's `finance.rahulchamp.ca` — installability and
  push are scoped per-origin, so each is a distinct installable app on the
  phone even though they share one database.

## The workflow

FSM completes transaction → prepares the delivery in Pulse (customer, vehicle,
VIN, salesperson, lender/lessor, approval status, delivery date/time, money
due/refund, structured requirements, free-form FSM notes) → salesperson is
pushed a "new delivery assigned" notification → salesperson resolves each
requirement as **completed** or **exception** (exceptions require a reason —
no silent completion) → delivery's overall status is recomputed automatically
(`new` → `requirements_outstanding` → `ready`) → salesperson marks delivered
once nothing is outstanding → every step is logged to `delivery_events`.

## Roles

- **Master Administrator / General Manager / FSM** — create deliveries, assign a
  salesperson, set approval status, delivery date/time, money due/refund,
  collection requirements (void cheque, trade release, ownership, etc.), and
  FSM notes (kept separate from requirements — notes are not a workflow item).
- **Salesperson** — sees only their assigned deliveries, enables push
  notifications, resolves requirements (complete or documented exception),
  can't mark a delivery "delivered" while any requirement is still outstanding.

## Local development

```
cd web
cp .env.example .env
npm install
npm run dev
```

`.env.example` already has the Axiom project URL, anon key, and the VAPID public key.

## Edge function secrets (one-time, Supabase dashboard or CLI)

`send-webpush` and `delivery-reminders` need the VAPID keypair as function
secrets on the Axiom project. The public key is safe to keep in `.env.example`;
the **private key is not stored anywhere in this repo** — it was generated
once and handed to you directly in chat. Set both via the Supabase dashboard
(Project Settings → Edge Functions → Secrets) or the CLI:

```
supabase secrets set --project-ref tbptlrewwxhggxxfdiks \
  VAPID_PUBLIC_KEY=<see web/.env.example> \
  VAPID_PRIVATE_KEY=<the private key from chat — do not commit it>
```

`delivery-reminders` also uses `SUPABASE_SERVICE_ROLE_KEY`, which Supabase
injects into every edge function automatically — nothing to configure there.

If the VAPID private key is ever lost, generate a fresh keypair and update both
the secret and `VITE_VAPID_PUBLIC_KEY` in `.env` — existing push subscriptions
will need to re-subscribe.

## Known follow-ups

- App icon is currently SVG-only (`web/public/icons/icon.svg`); generate proper
  192×192 / 512×512 PNGs (e.g. `npx pwa-asset-generator`) for best iOS home-screen
  icon fidelity.
- Existing `profiles.role` values in the Axiom project are `FSM`, `General Manager`,
  `Master Administrator`. Any user who should see the salesperson view needs
  `role = 'Salesperson'` set explicitly — no such profiles exist yet, so create/edit
  one to test that path end-to-end.
- `deliveries` is not linked to the Command Center `deals` table yet — `deals`
  is currently just an empty, unstructured `jsonb` blob (0 rows), not a real
  transaction record, so there's nothing safe to key against today. Revisit
  once F&I builds out a structured deal object.
- Old prototype's Supabase project (`AXIOM PULSE`, paused) is no longer needed by
  this build; safe to leave paused or delete once this is verified in production.
- Not yet built: FSM-side view of `delivery_events` (the audit trail exists in
  the database and is populated, just not surfaced in the UI yet).
