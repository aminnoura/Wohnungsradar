import { useQuery } from '@tanstack/react-query';
import { SOURCES } from '@wr/shared';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/components/theme';
import { api } from '@/lib/api';
import { ago } from '@/lib/format';

const KIND_LABEL = { portal: 'Portal', 'public-housing': 'Landeseigene WBG', landlord: 'Vermieter', swap: 'Tausch', furnished: 'Möbliert auf Zeit', discovery: 'Websuche' };

/** Every portal we aggregate, with crawl health. */
export default function SourcesScreen() {
  const t = useTheme();
  const meta = useQuery({ queryKey: ['meta'], queryFn: api.meta });
  const status = useQuery({ queryKey: ['status'], queryFn: api.status, refetchInterval: 60_000 });
  const statusBy = Object.fromEntries((status.data ?? []).map((s) => [s.source, s]));
  const activeBy = Object.fromEntries((meta.data?.sources ?? []).map((s) => [s.id, s.active]));

  return (
    <ScrollView contentContainerStyle={{ padding: 12, maxWidth: 900, width: '100%', alignSelf: 'center' }}>
      <Text style={{ color: t.muted, marginBottom: 8 }}>
        {SOURCES.length} Quellen. „Websuche“-Quellen werden über die Brave-Suche gefunden, z. B. ImmoScout-Suchen+-Inserate, die auch anderswo stehen.
      </Text>
      {SOURCES.map((s) => {
        const st = statusBy[s.id];
        const color = !st ? t.muted : st.error ? t.warn : t.good;
        return (
          <Pressable key={s.id} onPress={() => WebBrowser.openBrowserAsync(s.homepage)} style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '600' }}>{s.name}</Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>
                {KIND_LABEL[s.kind]} · {s.coverage === 'berlin' ? 'Berlin' : 'Deutschland'} · {s.method === 'brave' ? 'via Websuche' : 'direkt'}
              </Text>
              {st?.error && <Text style={{ color: t.warn, fontSize: 12 }} numberOfLines={2}>{st.error}</Text>}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: t.text }}>{activeBy[s.id] ?? 0}</Text>
              <Text style={{ color: t.muted, fontSize: 11 }}>{st ? `${st.new24h} neu/24h · ${ago(st.lastRun)}` : 'noch nicht gelaufen'}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
