import { useQuery } from '@tanstack/react-query';
import { CITIES } from '@wr/geo';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ListingsMap } from '@/components/ListingsMap';
import { useTheme } from '@/components/theme';
import { api } from '@/lib/api';
import { useFilters } from '@/lib/filters';

export default function MapScreen() {
  const t = useTheme();
  const { filters, set } = useFilters();
  const [bbox, setBbox] = useState<[number, number, number, number] | undefined>();
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const city = CITIES.find((c) => c.name === filters.city) ?? CITIES[0];

  const q = useQuery({
    queryKey: ['map', filters, bbox?.map((n) => n.toFixed(3))],
    queryFn: () => api.search(filters, { limit: 500, bbox }),
    enabled: !!bbox,
    placeholderData: (prev) => prev,
  });

  const polygon = drawing ? draft : (filters.polygon ?? []);

  return (
    <View style={{ flex: 1 }}>
      <ListingsMap
        listings={q.data?.items ?? []}
        center={city}
        polygon={polygon}
        drawing={drawing}
        onAddPoint={(p) => setDraft((d) => [...d, p])}
        onRegionChange={setBbox}
      />
      <View style={[styles.panel, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={{ color: t.text, flex: 1 }}>
          {drawing ? `Tippe Eckpunkte (${draft.length})` : `${q.data?.items.length ?? 0} von ${q.data?.total ?? 0} im Ausschnitt`}
        </Text>
        {drawing ? (
          <>
            <Pressable onPress={() => { setDrawing(false); setDraft([]); }} style={styles.btn}>
              <Text style={{ color: t.muted }}>Abbrechen</Text>
            </Pressable>
            <Pressable
              disabled={draft.length < 3}
              onPress={() => { set({ polygon: draft }); setDrawing(false); setDraft([]); }}
              style={[styles.btn, { backgroundColor: draft.length < 3 ? t.chip : t.accent }]}
            >
              <Text style={{ color: draft.length < 3 ? t.muted : t.accentText, fontWeight: '600' }}>Übernehmen</Text>
            </Pressable>
          </>
        ) : filters.polygon ? (
          <Pressable onPress={() => set({ polygon: undefined })} style={styles.btn}>
            <Text style={{ color: t.accent }}>Bereich entfernen</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setDrawing(true)} style={[styles.btn, { backgroundColor: t.accent }]}>
            <Text style={{ color: t.accentText, fontWeight: '600' }}>Bereich zeichnen</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, zIndex: 1000 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
});
