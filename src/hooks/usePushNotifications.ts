import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UsePushNotificationsProps {
  userId?: string;
  enabled?: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = ({ userId, enabled = true }: UsePushNotificationsProps) => {
  const subscribedRef = useRef(false);

  const getVapidKey = useCallback(async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('push-notifications', {
        body: { action: 'get-vapid-key' },
      });

      if (error) {
        console.warn('Error fetching VAPID key:', error);
        return null;
      }

      return data?.publicKey || null;
    } catch (err) {
      console.warn('Failed to get VAPID key:', err);
      return null;
    }
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!userId || !enabled || subscribedRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return;
    }

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return;
      }

      // Wait for service worker to be ready
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const registration = await navigator.serviceWorker.ready as any;

      // Check if already subscribed
      const existingSubscription = await registration.pushManager?.getSubscription();
      if (existingSubscription) {
        // Send to backend in case it's not stored
        await sendSubscriptionToServer(existingSubscription);
        subscribedRef.current = true;
        return;
      }

      // Get VAPID public key
      const vapidKey = await getVapidKey();
      if (!vapidKey) {
        console.warn('No VAPID key available');
        return;
      }

      // Subscribe to push
      const subscription = await registration.pushManager?.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send subscription to backend
      await sendSubscriptionToServer(subscription);
      subscribedRef.current = true;
      console.log('Push notification subscription successful');
    } catch (err) {
      console.warn('Failed to subscribe to push:', err);
    }
  }, [userId, enabled, getVapidKey]);

  const sendSubscriptionToServer = async (subscription: PushSubscription) => {
    try {
      const { error } = await supabase.functions.invoke('push-notifications', {
        body: {
          action: 'subscribe',
          subscription: subscription.toJSON(),
        },
      });

      if (error) {
        console.error('Error saving push subscription:', error);
      }
    } catch (err) {
      console.error('Failed to send subscription:', err);
    }
  };

  useEffect(() => {
    if (!userId || !enabled) return;

    // Small delay to not block initial page load
    const timer = setTimeout(() => {
      subscribeToPush();
    }, 3000);

    return () => clearTimeout(timer);
  }, [userId, enabled, subscribeToPush]);

  return { subscribeToPush };
};
