import Ionicons from '@expo/vector-icons/Ionicons';
import type { FavoriteStatus, Listing } from '@wr/shared';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ago, badges, factsLine, placeLine, priceLine, sourceName } from '@/lib/format';
import { Badge } from './Chip';
import { useTheme, type Theme } from './theme';

interface Props {
  listing: Listing;
  /** Current Merkliste status, highlights the matching action. */
  status?: FavoriteStatus | null;
  /** Show the action bar; null clears the status. */
  onAction?: (listing: Listing, status: FavoriteStatus | null) => void;
}

function Action({ icon, label, active, onPress, t }: { icon: keyof typeof Ionicons.glyphMap; label: string; active: boolean; onPress: () => void; t: Theme }) {
  return (
    <Pressable onPress={onPress} style={styles.action} accessibilityRole="button" accessibilityState={{ selected: active }} hitSlop={6}>
      <Ionicons name={icon} size={16} color={active ? t.accent : t.muted} />
      <Text style={{ color: active ? t.accent : t.muted, fontSize: 12, fontWeight: active ? '700' : '400' }}>{label}</Text>
    </Pressable>
  );
}

export function ListingCard({ listing: l, status, onAction }: Props) {
  const t = useTheme();
  const sources = [l.source, ...(l.alsoOn ?? []).map((a) => a.source)];
  const toggle = (s: FavoriteStatus) => onAction?.(l, status === s ? null : s);
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      {/* Link asChild rejects style arrays on its child, and the action bar stays outside the link so its taps don't navigate. */}
      <Link href={{ pathname: '/listing/[id]', params: { id: l.id } }} asChild>
        <Pressable style={styles.main}>
          {l.imageUrl ? (
            <Image source={{ uri: l.imageUrl }} style={styles.img} contentFit="cover" transition={150} />
          ) : (
            <View style={StyleSheet.flatten([styles.img, { backgroundColor: t.chip }])} />
          )}
          <View style={styles.body}>
            <Text style={[styles.price, { color: t.text }]}>{priceLine(l)}</Text>
            <Text style={{ color: t.text, fontSize: 13 }}>{factsLine(l)}</Text>
            <Text numberOfLines={2} style={[styles.title, { color: t.text }]}>{l.title}</Text>
            <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12 }}>{placeLine(l)}</Text>
            <View style={styles.badges}>{badges(l).map((b) => <Badge key={b.label} {...b} />)}</View>
            <Text numberOfLines={1} style={{ color: t.muted, fontSize: 11, marginTop: 4 }}>
              {[...new Set(sources)].map(sourceName).join(' · ')} · {ago(l.postedAt ?? l.firstSeenAt)}
            </Text>
          </View>
        </Pressable>
      </Link>
      {onAction && (
        <View style={[styles.actions, { borderColor: t.border }]}>
          <Action t={t} icon={status === 'saved' ? 'heart' : 'heart-outline'} label="Merken" active={status === 'saved'} onPress={() => toggle('saved')} />
          <Action t={t} icon={status === 'applied' ? 'checkmark-circle' : 'checkmark-circle-outline'} label="Beworben" active={status === 'applied'} onPress={() => toggle('applied')} />
          <Action t={t} icon={status === 'hidden' ? 'eye' : 'eye-off-outline'} label={status === 'hidden' ? 'Einblenden' : 'Ausblenden'} active={false} onPress={() => toggle('hidden')} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginHorizontal: 12, marginVertical: 5 },
  main: { flexDirection: 'row' },
  img: { width: 112, minHeight: 112 },
  body: { flex: 1, padding: 10, gap: 1 },
  price: { fontSize: 15, fontWeight: '700' },
  title: { fontSize: 13, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
});
