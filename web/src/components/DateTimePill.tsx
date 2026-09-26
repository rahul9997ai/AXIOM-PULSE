import type { ReactNode } from 'react';
import { CalendarIcon } from './Icons';

// Shared date/time chip used on both the Deliveries list card and the
// delivery detail page — kept as one component so the two never drift
// apart, and themed via CSS vars so it doesn't stay a bright mint card
// in dark mode.
export default function DateTimePill({ date, action }: { date: Date; action?: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: action ? 'space-between' : 'flex-start', gap: 7,
      padding: '9px 13px', borderRadius: 12, background: 'var(--pill-green-bg)',
      boxShadow: '-3px -3px 8px var(--neu-hi), 4px 5px 12px rgba(21,128,61,0.10)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ color: 'var(--pill-green-fg)', display: 'flex' }}><CalendarIcon size={16} /></span>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--pill-green-fg)' }}>
          {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--pill-green-fg)' }}>
          {date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
      {action}
    </div>
  );
}
