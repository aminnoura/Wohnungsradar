import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from './theme';

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[styles.chip, { backgroundColor: active ? t.accent : t.chip, borderColor: active ? t.accent : t.border }]}
    >
      <Text style={{ color: active ? t.accentText : t.text, fontSize: 13, fontWeight: active ? '600' : '400' }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone }: { label: string; tone: 'warn' | 'info' | 'good' }) {
  const t = useTheme();
  const [fg, bg] = tone === 'warn' ? [t.warn, t.warnBg] : tone === 'good' ? [t.good, t.goodBg] : [t.info, t.infoBg];
  return <Text style={[styles.badge, { color: fg, backgroundColor: bg }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, marginRight: 6, marginBottom: 6 },
  badge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 4, overflow: 'hidden' },
});
