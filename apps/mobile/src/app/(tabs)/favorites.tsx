import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { ListingCard } from '@/components/ListingCard';
import { UndoBar } from '@/components/UndoBar';
import { useTheme } from '@/components/theme';
import { api, type FavoriteStatus } from '@/lib/api';
import { useMarkListing } from '@/lib/useMarkListing';

const COLUMNS: { value: FavoriteStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'saved', label: 'Gemerkt' },
  { value: 'contacted', label: 'Angefragt' },
  { value: 'viewing', label: 'Besichtigung' },
  { value: 'applied', label: 'Beworben' },
  { value: 'rejected', label: 'Abgesagt' },
  { value: 'hidden', label: 'Ausgeblendet' },
];

/** Application tracker: every flat with a status. Hidden ones only appear under „Ausgeblendet“, where they can be restored. */
export default function FavoritesScreen() {
  const t = useTheme();
  const [status, setStatus] = useState<FavoriteStatus | 'all'>('all');
  const q = useQuery({ queryKey: ['favorites'], queryFn: api.favorites });
  const { mark, undo, last } = useMarkListing();
  const matches = (s: FavoriteStatus | 'all', f: FavoriteStatus) => (s === 'all' ? f !== 'hidden' : f === s);
  const items = (q.data ?? []).filter((f) => matches(status, f.status));
  const count = (s: FavoriteStatus | 'all') => (q.data ?? []).filter((f) => matches(s, f.status)).length;

  return (
    <View style={{ flex: 1 }}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 10 }}>
          {COLUMNS.map((c) => (
            <Chip key={c.value} label={`${c.label} (${count(c.value)})`} active={status === c.value} onPress={() => setStatus(c.value)} />
          ))}
        </ScrollView>
      </View>
      {q.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(f) => f.listing.id}
          renderItem={({ item }) => <ListingCard listing={item.listing} status={item.status} onAction={mark} />}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          contentContainerStyle={{ maxWidth: 900, width: '100%', alignSelf: 'center' }}
          ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center', marginTop: 40 }}>Noch nichts gemerkt.</Text>}
        />
      )}
      <UndoBar last={last} onUndo={undo} />
    </View>
  );
}
