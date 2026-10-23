import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LastAction } from '@/lib/useMarkListing';
import { useTheme } from './theme';

const LABEL: Record<string, string> = {
  hidden: 'Ausgeblendet', applied: 'Als beworben markiert', rejected: 'Als abgesagt markiert', saved: 'Gemerkt',
  contacted: 'Als angefragt markiert', viewing: 'Besichtigung eingetragen',
};

export function UndoBar({ last, onUndo }: { last: LastAction | null; onUndo: () => void }) {
  const t = useTheme();
  if (!last) return null;
  return (
    <View style={[styles.bar, { backgroundColor: t.text }]}>
      <Text style={{ color: t.bg, flex: 1 }} numberOfLines={1}>
        {last.status ? LABEL[last.status] : 'Entfernt'}: {last.listing.title}
      </Text>
      <Pressable onPress={onUndo} hitSlop={10}>
        <Text style={{ color: t.accent, fontWeight: '700' }}>Rückgängig</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, maxWidth: 700, alignSelf: 'center' },
});
