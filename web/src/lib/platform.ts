// Shared device-detection helpers used by both the install-prompt flow
// (pwaInstall.ts) and the push-notification flow (push.ts) — kept in one
// place so the two can't drift.
export function isStandaloneDisplay(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}
