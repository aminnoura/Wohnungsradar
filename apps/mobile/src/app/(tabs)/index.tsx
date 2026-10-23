import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { countActiveFilters } from '@wr/shared';
import { router, Stack } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ListingCard } from '@/components/ListingCard';
import { UndoBar } from '@/components/UndoBar';
import { useTheme } from '@/components/theme';
import { api } from '@/lib/api';
import { useFilters } from '@/lib/filters';
import { useMarkListing } from '@/lib/useMarkListing';

const PAGE = 30;

export default function SearchScreen() {
  const t = useTheme();
  const filters = useFilters((s) => s.filters);
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ['search', filters],
    queryFn: ({ pageParam }) => api.search(filters, { limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (pages.length * PAGE < last.total ? pages.length * PAGE : undefined),
    refetchInterval: 2 * 60_000,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;
  const active = countActiveFilters(filters);
  const { mark, undo, last, statusOf } = useMarkListing();

  const save = useMutation({
    mutationFn: (name: string) => api.saveSearch(name, filters),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved'] });
      const msg = 'Gespeichert – du bekommst eine Benachrichtigung, sobald neue passende Wohnungen auftauchen.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Suche gespeichert', msg);
    },
  });

  const promptSave = () => {
    const name = [filters.city, filters.bezirke?.join(', '), filters.warmRent?.max && `≤ ${filters.warmRent.max} €`].filter(Boolean).join(' · ') || 'Meine Suche';
    if (Platform.OS === 'web') {
      const n = window.prompt('Name der Suche', name);
      if (n) save.mutate(n);
    } else if (Platform.OS === 'ios') {
      Alert.prompt('Suche speichern', 'Name', (n) => n && save.mutate(n), 'plain-text', name);
    } else {
      save.mutate(name);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Wohnungsradar' }} />
      <View style={[styles.bar, { backgroundColor: t.card, borderColor: t.border }]}>
        <Pressable onPress={() => router.push('/filters')} style={[styles.btn, { backgroundColor: t.accent }]}>
          <Ionicons name="options" size={16} color={t.accentText} />
          <Text style={{ color: t.accentText, fontWeight: '600' }}>Filter{active ? ` (${active})` : ''}</Text>
        </Pressable>
        <Text style={{ color: t.muted, flex: 1, marginLeft: 10 }} numberOfLines={1}>
          {q.isLoading ? 'Suche …' : `${total.toLocaleString('de-DE')} Wohnungen${filters.city ? ` in ${filters.city}` : ''}`}
        </Text>
        <Pressable onPress={promptSave} style={[styles.btn, { borderColor: t.border, borderWidth: 1 }]} accessibilityLabel="Suche speichern">
          <Ionicons name="notifications-outline" size={16} color={t.text} />
          <Text style={{ color: t.text }}>Alarm</Text>
        </Pressable>
      </View>
      {q.isError ? (
        <View style={styles.center}>
          <Text style={{ color: t.text, textAlign: 'center' }}>API nicht erreichbar.{'\n'}{String(q.error.message)}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => <ListingCard listing={item} status={statusOf(item.id)} onAction={mark} />}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          onEndReachedThreshold={0.5}
          refreshing={q.isRefetching && !q.isFetchingNextPage}
          onRefresh={() => q.refetch()}
          contentContainerStyle={{ paddingVertical: 6, maxWidth: 900, width: '100%', alignSelf: 'center' }}
          ListEmptyComponent={
            q.isLoading ? <ActivityIndicator style={{ marginTop: 40 }} /> : <Text style={[styles.empty, { color: t.muted }]}>Keine Wohnungen für diese Filter.</Text>
          }
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator style={{ margin: 16 }} /> : undefined}
        />
      )}
      <UndoBar last={last} onUndo={undo} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { textAlign: 'center', marginTop: 40 },
});
