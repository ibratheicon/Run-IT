import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * Native only. `push.web.ts` is a no-op twin that Metro picks for the
 * website, so expo-notifications never ends up in the web bundle.
 *
 * Foreground behaviour: still show the banner. Without this, a notification
 * that arrives while the app is open is silently dropped.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Ask once, store the token once. Safe to call on every launch: a duplicate
 * (user_id, token) is a 23505 and treated as success, like joinEvent.
 * Returns silently on simulators, denied permission, or missing projectId.
 */
export async function registerPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  const { error } = await supabase
    .from('push_tokens')
    .insert({ user_id: userId, token, platform: Platform.OS });

  if (error && error.code !== '23505') {
    console.warn(`Couldn't save push token (${error.message})`);
  }
}