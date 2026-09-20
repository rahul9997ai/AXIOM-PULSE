import { supabase } from './supabase';

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function isStandaloneDisplay(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function pushSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function enablePush(): Promise<void> {
  if (!window.isSecureContext) throw new Error('Notifications require a secure connection.');
  if (!pushSupported()) throw new Error('Push notifications are not supported on this device or browser.');
  if (isIOS() && !isStandaloneDisplay()) {
    throw new Error('On iPhone or iPad, add Axiom Pulse to your Home Screen first, then open it from there to enable notifications.');
  }

  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY as string),
    });
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in first.');

  const { error } = await supabase.functions.invoke('register-webpush', {
    body: { subscription: subscription.toJSON() },
  });
  if (error) throw error;
}

export async function sendTestPush(): Promise<{ sent: number }> {
  const { data, error } = await supabase.functions.invoke('send-webpush', {
    body: { test: true },
  });
  if (error) throw error;
  return data as { sent: number };
}
