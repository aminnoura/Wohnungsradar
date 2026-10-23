import type { Listing } from '@wr/shared';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ago, badges, factsLine, placeLine, priceLine, sourceName } from '@/lib/format';
import { Badge } from './Chip';
import { useTheme } from './theme';

export function ListingCard({ listing: l }: { listing: Listing }) {
  const t = useTheme();
  const sources = [l.source, ...(l.alsoOn ?? []).map((a) => a.source)];
  // Link asChild rejects style arrays on its child, so the Pressable's style is flattened.
  return (
    <Link href={{ pathname: '/listing/[id]', params: { id: l.id } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.card, { backgroundColor: t.card, borderColor: t.border }])}>
        {l.imageUrl ? (
          <Image source={{ uri: l.imageUrl }} style={styles.img} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.img, { backgroundColor: t.chip }]} />
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
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginHorizontal: 12, marginVertical: 5 },
  img: { width: 112, minHeight: 112 },
  body: { flex: 1, padding: 10, gap: 1 },
  price: { fontSize: 15, fontWeight: '700' },
  title: { fontSize: 13, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
});
