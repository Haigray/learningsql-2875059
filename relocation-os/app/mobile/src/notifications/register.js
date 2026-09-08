// Keeps the OS notification schedule in step with the plan.
//
// All wording and dates come from deriveNotifications(), which is pure and
// tested. This file only talks to Expo.

import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { usePlan } from '../PlanContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: true,
  }),
});

export async function requestPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
}

/** Fires at 9am local on the notification's date — nobody wants these at midnight. */
function triggerFor(dateISO) {
  const at = new Date(`${dateISO}T09:00:00`);
  return at.getTime() <= Date.now() ? null : { date: at };
}

export async function syncNotifications(notifications, enabled) {
  if (Platform.OS === 'web') return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled || !notifications.length) return 0;
  if (!(await requestPermission())) return 0;

  let scheduled = 0;
  // iOS caps pending local notifications at 64, so send the soonest ones and
  // re-sync on every launch rather than trying to schedule two years at once.
  for (const n of notifications.slice(0, 60)) {
    const trigger = triggerFor(n.at);
    if (!trigger) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: n.title, body: n.body, data: { taskKey: n.taskKey, category: n.category } },
      trigger,
    });
    scheduled++;
  }
  return scheduled;
}

export function useSyncNotifications() {
  const { notifications, state, hydrated } = usePlan();
  const enabled = state.settings.notificationsEnabled;
  const signature = notifications.map(n => `${n.id}@${n.at}`).join('|');

  useEffect(() => {
    if (!hydrated) return;
    syncNotifications(notifications, enabled).catch(e => console.warn('notification sync failed', e));
  }, [signature, enabled, hydrated]);
}
