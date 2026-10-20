import { useEffect, useRef, useState } from 'react';

// Numbers that roll up to their value instead of just appearing. Written
// by hand (no animation library): a requestAnimationFrame loop with an
// ease-out curve.
//
// - Each animation starts from whatever is on screen right now, so a value
//   that changes mid-count re-targets smoothly instead of jumping.
// - Given a `key`, the last value shown is remembered for the session, so
//   coming back to a screen shows the number instantly and only a real
//   change animates.
// - Reduced motion: the number simply appears.

const shown = new Map<string, number>();

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useCountUp(target: number, key?: string, duration = 800): number {
  const reduced = reducedMotion();
  const initial = reduced ? target : (key ? shown.get(key) ?? 0 : 0);
  const [value, setValue] = useState(initial);
  const live = useRef(initial);

  useEffect(() => {
    if (reduced || live.current === target) {
      live.current = target;
      setValue(target);
      if (key) shown.set(key, target);
      return;
    }
    const from = live.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4); // fast start, long gentle settle
      live.current = from + (target - from) * eased;
      setValue(live.current);
      if (t < 1) raf = requestAnimationFrame(tick);
      else if (key) shown.set(key, target);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (key) shown.set(key, live.current);
    };
  }, [target, key, duration, reduced]);

  return value;
}

export default function CountUp({ value, id, format, duration }: { value: number; id?: string; format?: (n: number) => string; duration?: number }) {
  const current = useCountUp(value, id, duration);
  const text = (n: number) => (format ? format(Math.round(n)) : String(Math.round(n)));
  // Screen readers get the final value once, not every frame of the count.
  return (
    <>
      <span className="sr-only">{text(value)}</span>
      <span aria-hidden="true" style={{ fontVariantNumeric: 'tabular-nums' }}>{text(current)}</span>
    </>
  );
}
