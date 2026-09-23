import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { AxiomLockup } from '@/components/AxiomMark';
import type { Role } from '@/lib/types';
import { CalendarIcon, HomeIcon, GearIcon, BellIcon } from '@/components/Icons';

interface Step { icon: React.ComponentType<{ size?: number }>; title: string; body: string; }

const SALESPERSON_STEPS: Step[] = [
  {
    icon: CalendarIcon,
    title: 'Your deliveries, by date',
    body: "Calendar shows every delivery you're assigned to, on the day it's scheduled. Tap a day to see what's on it.",
  },
  {
    icon: HomeIcon,
    title: "Today's deliveries",
    body: "The Deliveries tab is just what's happening today — tap a customer's card to open the full delivery.",
  },
  {
    icon: BellIcon,
    title: 'Requirements, one tap each',
    body: "Inside a delivery, each requirement is its own button — Void Chq, Trade Release, and so on. Tap to mark it complete, tap again to undo. Can't complete one? Tap the ! badge in the corner to flag an exception with a reason. Got a question for Finance? Send an approval request right from the same screen — you'll get a push notification the moment it's decided.",
  },
  {
    icon: GearIcon,
    title: 'Settings',
    body: 'Turn on push notifications so you never miss a new delivery or an approval decision, and switch between light and dark mode — all in Settings.',
  },
];

const MANAGER_STEPS: Step[] = [
  {
    icon: CalendarIcon,
    title: 'Deliveries, by date',
    body: 'Calendar lays out every delivery on its scheduled day. Deliveries shows the full list with stats and filters.',
  },
  {
    icon: HomeIcon,
    title: 'Create and assign',
    body: "Tap New to create a delivery: customer, lender, approval status, requirements, a due-on-delivery collection/refund, and the salesperson it's assigned to. They get a push notification the moment it's created — and again on any edit you make.",
  },
  {
    icon: BellIcon,
    title: 'Approvals & requirements',
    body: "Open any delivery to see live requirement progress, and approve or deny the salesperson's requests (a denial needs a reason). Use Notify to send an urgent push straight to them.",
  },
  {
    icon: GearIcon,
    title: 'Settings',
    body: 'Turn on push notifications so you hear about new questions right away, and switch between light and dark mode — all in Settings.',
  },
];

const MASTER_STEPS: Step[] = [
  {
    icon: HomeIcon,
    title: 'Admin home',
    body: 'Create dealerships, invite Salespeople/FSMs/GMs with a temporary password, and remove accounts that no longer need access.',
  },
  {
    icon: CalendarIcon,
    title: 'Viewing as',
    body: "Use the \"Viewing as\" bar at the top to preview the app as any role at any dealership — see exactly what they see.",
  },
  {
    icon: BellIcon,
    title: 'See everything, filtered',
    body: 'While previewing a Finance Manager or General Manager, you can view every delivery across the dealership, or filter down to one Finance Manager — including deliveries you created yourself.',
  },
  {
    icon: GearIcon,
    title: 'Settings',
    body: 'Turn on push notifications and switch between light and dark mode — all in Settings.',
  },
];

function stepsForRole(role: Role | undefined): Step[] {
  if (role === 'Salesperson') return SALESPERSON_STEPS;
  if (role === 'Master Administrator') return MASTER_STEPS;
  return MANAGER_STEPS;
}

export default function Welcome() {
  const { profile, refresh } = useSession();
  const steps = stepsForRole(profile?.role);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    await supabase.rpc('mark_welcome_seen');
    await refresh();
    setBusy(false);
  };

  const isIntro = index === 0;
  const isLast = index === steps.length;
  const step = isIntro ? null : steps[index - 1];

  return (
    <div className="landing">
      <div className="landing-bg" aria-hidden="true" />
      <header className="landing-head">
        <AxiomLockup size={40} />
      </header>
      <main className="landing-main">
        <section className="landing-card-wrap">
          <div className="landing-card" style={{ textAlign: 'center' }}>
            {isIntro ? (
              <>
                <h2>Welcome to Pulse</h2>
                <p className="landing-sub" style={{ marginBottom: 6 }}>
                  Hi {profile?.name?.split(' ')[0] || 'there'} — here's a quick look at what you can do.
                </p>
              </>
            ) : step ? (
              <>
                <div style={{
                  width: 52, height: 52, margin: '4px auto 14px', borderRadius: '50%',
                  background: 'var(--surface)', color: 'var(--blue)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <step.icon size={24} />
                </div>
                <h2 style={{ fontSize: 19 }}>{step.title}</h2>
                <p className="landing-sub" style={{ lineHeight: 1.5, marginBottom: 4 }}>{step.body}</p>
              </>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '18px 0 6px' }}>
              {Array.from({ length: steps.length + 1 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: i === index ? 'var(--blue)' : 'var(--line)',
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {!isIntro && (
                <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => setIndex((i) => i - 1)}>
                  Back
                </button>
              )}
              {!isLast ? (
                <button type="button" className="btn" style={{ flex: 2 }} onClick={() => setIndex((i) => i + 1)}>
                  {isIntro ? "Let's go" : 'Next'}
                </button>
              ) : (
                <button type="button" className="btn" style={{ flex: 2 }} disabled={busy} onClick={finish}>
                  {busy ? 'Starting…' : 'Get started'}
                </button>
              )}
            </div>
            {!isLast && (
              <button
                type="button"
                onClick={finish}
                disabled={busy}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12.5, marginTop: 12, cursor: 'pointer' }}
              >
                Skip
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
