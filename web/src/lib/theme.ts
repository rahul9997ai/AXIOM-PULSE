export type Theme = 'light' | 'dark';

const KEY = 'pulse_theme';

const prefersDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// The person's own choice if they've made one, otherwise whatever their
// device is set to.
export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch { /* ignore */ }
  return prefersDark() ? 'dark' : 'light';
}

interface ApplyOptions {
  // Remember the choice. Off at startup, so a device default isn't frozen in
  // as if the person had picked it.
  persist?: boolean;
  // Cross-fade the whole page rather than flipping instantly (a sudden
  // light/dark jump is jarring). Skipped when reduced motion is on or the
  // browser has no View Transitions.
  animate?: boolean;
}

export function applyTheme(theme: Theme, { persist = true, animate = false }: ApplyOptions = {}): void {
  const apply = () => document.documentElement.setAttribute('data-theme', theme);
  const withTransition = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
  if (animate && withTransition && !prefersReducedMotion()) withTransition.call(document, apply);
  else apply();
  if (persist) {
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }
}
