export type Theme = 'light' | 'dark';

const KEY = 'pulse_theme';

export function getStoredTheme(): Theme {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
}
