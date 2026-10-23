import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { ListingCard } from '@/components/ListingCard';
import { useTheme } from '@/components/theme';
import { api, type FavoriteStatus } from '@/lib/api';

const COLUMNS: { value: FavoriteStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'saved', label: 'Gemerkt' },
  { value: 'contacted', label: 'Angefragt' },
  { value: 'viewing', label: 'Besichtigung' },
  { value: 'applied', label: 'Beworben' },
  { value: 'rejected', label: 'Abgesagt' },
];

/** Application tracker: every saved flat with its status (status is changed on the detail page). */
export default function FavoritesScreen() {
  const t = useTheme();
  const [status, setStatus] = useState<FavoriteStatus | 'all'>('all');
  const q = useQuery({ queryKey: ['favorites'], queryFn: api.favorites });
  const items = (q.data ?? []).filter((f) => status === 'all' || f.status === status);
  const count = (s: FavoriteStatus | 'all') => (q.data ?? []).filter((f) => s === 'all' || f.status === s).length;

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
          renderItem={({ item }) => <ListingCard listing={item.listing} />}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          contentContainerStyle={{ maxWidth: 900, width: '100%', alignSelf: 'center' }}
          ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center', marginTop: 40 }}>Noch nichts gemerkt.</Text>}
        />
      )}
    </View>
  );
}
