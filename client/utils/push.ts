/**
 * Vencos Push Notification Utilities
 * Handles: permission request, subscription management, local notifications
 */

// Check if push notifications are supported
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Get current permission status
export function getNotificationPermission(): string {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

// Subscribe to push notifications (returns subscription for server storage)
export async function subscribeToPush(vapidPublicKey?: string): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) return existing;

    // Build options - use any to avoid strict TS issues with applicationServerKey
    const opts: Record<string, unknown> = { userVisibleOnly: true };
    if (vapidPublicKey) {
      const padding = '='.repeat((4 - vapidPublicKey.length % 4) % 4);
      const base64 = (vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const arr = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) arr[i] = rawData.charCodeAt(i);
      opts.applicationServerKey = arr;
    }
    const subscription = await registration.pushManager.subscribe(opts as PushSubscriptionOptionsInit);
    return subscription;
  } catch (err) {
    console.error('[Vencos Push] Subscribe failed:', err);
    return null;
  }
}

// Unsubscribe from push
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) return await subscription.unsubscribe();
    return true;
  } catch (err) {
    console.error('[Vencos Push] Unsubscribe failed:', err);
    return false;
  }
}

// Show a local notification (doesn't need push server)
export async function showLocalNotification(
  title: string,
  body: string,
  tag?: string
): Promise<void> {
  if (!isPushSupported()) return;
  const permission = await requestNotificationPermission();
  if (!permission) return;
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, { body, icon: './icons/icon-192x192.png', badge: './icons/icon-96x96.png', tag: tag || 'vencos-local' });
}

// Notification types for Vencos
export type VencosNotificationType =
  | 'invoice_due'
  | 'payment_received'
  | 'lease_expiring'
  | 'maintenance_new'
  | 'maintenance_update'
  | 'task_assigned'
  | 'system';
