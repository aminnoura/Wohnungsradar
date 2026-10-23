import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/**
 * Ask for permission and register this device's Expo push token with the API. Web uses the in-app
 * inbox instead. Returns false if push isn't available (simulator, denied, or no EAS projectId yet).
 */
export async function registerForPush(): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Neue Wohnungen', importance: Notifications.AndroidImportance.MAX });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return false;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return false;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.pushToken(data, Platform.OS as 'ios' | 'android');
    return true;
  } catch {
    return false;
  }
}
