import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useTheme } from '@/components/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.accent,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.card },
        headerTintColor: t.text,
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Suche', tabBarIcon: icon('search') }} />
      <Tabs.Screen name="map" options={{ title: 'Karte', tabBarIcon: icon('map') }} />
      <Tabs.Screen name="favorites" options={{ title: 'Merkliste', tabBarIcon: icon('heart') }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alarme', tabBarIcon: icon('notifications') }} />
      <Tabs.Screen name="sources" options={{ title: 'Quellen', tabBarIcon: icon('globe') }} />
    </Tabs>
  );
}
