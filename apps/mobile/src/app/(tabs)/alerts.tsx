import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { countActiveFilters } from '@wr/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { ListingCard } from '@/components/ListingCard';
import { useTheme } from '@/components/theme';
import { api } from '@/lib/api';
import { useFilters } from '@/lib/filters';
import { ago } from '@/lib/format';
import { registerForPush } from '@/lib/push';
import { useMarkListing } from '@/lib/useMarkListing';

export default function AlertsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const replace = useFilters((s) => s.replace);
  const [pushOk, setPushOk] = useState<boolean | null>(null);
  const saved = useQuery({ queryKey: ['saved'], queryFn: api.savedSearches });
  const inbox = useQuery({ queryKey: ['notifications'], queryFn: api.notifications, refetchInterval: 60_000 });

  useEffect(() => {
    registerForPush().then(setPushOk);
  }, []);

  const toggle = useMutation({
    mutationFn: ({ id, notify }: { id: string; notify: boolean }) => api.updateSearch(id, { notify }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  });
  const remove = useMutation({ mutationFn: api.deleteSearch, onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }) });
  const markRead = useMutation({ mutationFn: api.readNotifications, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const unread = inbox.data?.filter((n) => !n.read).length ?? 0;
  const { mark, statusOf } = useMarkListing();

  return (
    <ScrollView contentContainerStyle={{ paddingVertical: 10, maxWidth: 900, width: '100%', alignSelf: 'center' }}>
      {Platform.OS !== 'web' && pushOk === false && (
        <Text style={[styles.hint, { color: t.muted }]}>
          Push ist auf diesem Gerät nicht aktiv (Berechtigung fehlt, Simulator oder noch kein EAS-Projekt). Neue Treffer erscheinen trotzdem unten.
        </Text>
      )}
      <Text style={[styles.h, { color: t.text }]}>Gespeicherte Suchen</Text>
      {(saved.data ?? []).map((s) => (
        <View key={s.id} style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
          <Pressable style={{ flex: 1 }} onPress={() => { replace(s.filters); router.navigate('/'); }}>
            <Text style={{ color: t.text, fontWeight: '600' }}>{s.name}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>
              {countActiveFilters(s.filters)} Filter{s.unread ? ` · ${s.unread} neu` : ''}
            </Text>
          </Pressable>
          <Switch value={s.notify} onValueChange={(notify) => toggle.mutate({ id: s.id, notify })} />
          <Pressable onPress={() => remove.mutate(s.id)} accessibilityLabel="Suche löschen" style={{ padding: 6 }}>
            <Ionicons name="trash-outline" size={18} color={t.muted} />
          </Pressable>
        </View>
      ))}
      {!saved.data?.length && (
        <Text style={[styles.hint, { color: t.muted }]}>Noch keine Suche gespeichert. In der Suche oben „Alarm“ tippen.</Text>
      )}

      <View style={[styles.headRow]}>
        <Text style={[styles.h, { color: t.text }]}>Neue Treffer{unread ? ` (${unread})` : ''}</Text>
        {unread > 0 && (
          <Pressable onPress={() => markRead.mutate()}>
            <Text style={{ color: t.accent }}>Alle gelesen</Text>
          </Pressable>
        )}
      </View>
      {(inbox.data ?? []).filter((n) => statusOf(n.listing.id) !== 'hidden').map((n) => (
        <View key={n.id} style={{ opacity: n.read ? 0.65 : 1 }}>
          <Text style={{ color: t.muted, fontSize: 11, marginLeft: 16 }}>{n.searchName} · {ago(n.createdAt)}</Text>
          <ListingCard listing={n.listing} status={statusOf(n.listing.id)} onAction={mark} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 17, fontWeight: '700', marginHorizontal: 16, marginVertical: 8 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginRight: 16, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginVertical: 4, padding: 12, borderRadius: 10, borderWidth: 1 },
  hint: { marginHorizontal: 16, marginVertical: 6, fontSize: 13 },
});
