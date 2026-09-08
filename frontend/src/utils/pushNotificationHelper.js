import axios from 'axios';
import API_URL from '../config/api';

/**
 * Convert a base64 string to a Uint8Array for applicationServerKey
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if the browser supports Service Workers & Push Notifications
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get current browser notification permission
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'granted', 'denied', or 'default'
}

/**
 * Register Service Worker
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker is not supported in this browser.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return registration;
}

/**
 * Request notification permission and subscribe to native Web Push
 */
export async function requestPushPermissionAndSubscribe() {
  if (!isPushSupported()) {
    throw new Error('Web Push notifications are not supported by your browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied by user.');
  }

  const registration = await registerServiceWorker();

  // Fetch VAPID Public Key from server
  const { data } = await axios.get(`${API_URL}/notifications/vapid-public-key`);
  if (!data || !data.publicKey) {
    throw new Error('Failed to retrieve VAPID public key from server.');
  }

  const applicationServerKey = urlBase64ToUint8Array(data.publicKey);

  // Subscribe user to PushManager
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
  }

  const subJson = subscription.toJSON();

  // Send subscription to Backend
  await axios.post(`${API_URL}/notifications/push-subscribe`, {
    endpoint: subJson.endpoint,
    keys: subJson.keys
  });

  return subscription;
}

/**
 * Unsubscribe current browser from Web Push Notifications
 */
export async function unsubscribePushNotification() {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    try {
      await axios.delete(`${API_URL}/notifications/push-subscribe`, {
        data: { endpoint }
      });
    } catch (e) {
      console.warn('Failed to delete push subscription on backend:', e);
    }
  }
}
