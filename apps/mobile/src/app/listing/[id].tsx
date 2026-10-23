import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Listing } from '@wr/shared';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Chip } from '@/components/Chip';
import { useTheme } from '@/components/theme';
import { api, type FavoriteStatus } from '@/lib/api';
import { ago, badges, factsLine, formatEur, placeLine, priceLine, sourceName } from '@/lib/format';

const yesNo = (b: boolean | null) => (b == null ? null : b ? 'ja' : 'nein');

function facts(l: Listing): [string, string | null][] {
  return [
    ['Kaltmiete', l.coldRent != null ? formatEur(l.coldRent) : null],
    ['Warmmiete', l.warmRent != null ? formatEur(l.warmRent) : null],
    ['Nebenkosten', l.extraCosts != null ? formatEur(l.extraCosts) : null],
    ['Kaution', l.deposit != null ? formatEur(l.deposit) : null],
    ['€/m² kalt', l.coldRent && l.sizeM2 ? `${(l.coldRent / l.sizeM2).toFixed(2).replace('.', ',')} €` : null],
    ['Wohnfläche', l.sizeM2 != null ? `${l.sizeM2.toLocaleString('de-DE')} m²` : null],
    ['Zimmer', l.rooms != null ? String(l.rooms).replace('.', ',') : null],
    ['Schlafzimmer', l.bedrooms != null ? String(l.bedrooms) : null],
    ['Badezimmer', l.bathrooms != null ? String(l.bathrooms) : null],
    ['Etage', l.floor != null ? `${l.floor === 0 ? 'EG' : l.floor}${l.totalFloors ? ` von ${l.totalFloors}` : ''}` : null],
    ['Adresse', [l.street, [l.plz, l.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null],
    ['Bezirk / Ortsteil', [l.bezirk, l.ortsteil].filter(Boolean).join(' / ') || null],
    ['WBS', l.wbsRequired == null ? null : l.wbsRequired ? `erforderlich${l.wbsLevel ? ` (WBS ${l.wbsLevel})` : ''}` : 'nicht erforderlich'],
    ['Tausch', yesNo(l.isSwap)],
    ['Bezugsfrei ab', l.availableFrom],
    ['Befristet', yesNo(l.limitedTerm)],
    ['Möbliert', l.furnished && { none: 'nein', partly: 'teilweise', full: 'ja' }[l.furnished]],
    ['Baujahr', l.yearBuilt != null ? String(l.yearBuilt) : null],
    ['Bauart', l.buildingType && { altbau: 'Altbau', neubau: 'Neubau' }[l.buildingType]],
    ['Energieklasse', l.energyClass],
    ['Heizung', l.heatingType],
    ['Aufzug', yesNo(l.elevator)],
    ['Balkon/Terrasse', yesNo(l.balcony)],
    ['Einbauküche', yesNo(l.kitchen)],
    ['Keller', yesNo(l.cellar)],
    ['Garten', yesNo(l.garden)],
    ['Barrierefrei', yesNo(l.barrierFree)],
    ['Haustiere', yesNo(l.petsAllowed)],
    ['Provisionsfrei', yesNo(l.noCommission)],
    ['Anbieter', l.offerer && { private: 'Privat', agent: 'Makler', company: 'Wohnungsbaugesellschaft' }[l.offerer]],
  ];
}

const STATUSES: { value: FavoriteStatus; label: string }[] = [
  { value: 'saved', label: 'Gemerkt' },
  { value: 'contacted', label: 'Angefragt' },
  { value: 'viewing', label: 'Besichtigung' },
  { value: 'applied', label: 'Beworben' },
  { value: 'rejected', label: 'Abgesagt' },
  { value: 'hidden', label: 'Ausblenden' },
];

export default function ListingScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['listing', id], queryFn: () => api.listing(id) });
  const favs = useQuery({ queryKey: ['favorites'], queryFn: api.favorites });
  const fav = favs.data?.find((f) => f.listing.id === id);
  const setFav = useMutation({
    mutationFn: (s: FavoriteStatus | null) => (s ? api.setFavorite(id, s) : api.removeFavorite(id)),
    onSuccess: () => {
      // Applied/rejected/hidden listings drop out of search and map, so refresh those too.
      for (const key of ['favorites', 'search', 'map']) qc.invalidateQueries({ queryKey: [key] });
    },
  });

  useEffect(() => {
    api.markSeen([id]).catch(() => {});
  }, [id]);

  if (q.isLoading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  const l = q.data;
  if (!l) return <Text style={{ color: t.text, padding: 20 }}>Nicht gefunden.</Text>;
  const alternatives = l.alsoOn ?? [];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40, maxWidth: 820, width: '100%', alignSelf: 'center' }}>
      <Stack.Screen options={{ title: sourceName(l.source) }} />
      {l.imageUrl && <Image source={{ uri: l.imageUrl }} style={{ width: '100%', aspectRatio: 16 / 10 }} contentFit="cover" />}
      <View style={{ padding: 16, gap: 6 }}>
        <Text style={{ color: t.text, fontSize: 20, fontWeight: '700' }}>{priceLine(l)}</Text>
        <Text style={{ color: t.text, fontSize: 15 }}>{factsLine(l)} · {placeLine(l)}</Text>
        <Text style={{ color: t.text, fontSize: 16 }}>{l.title}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{badges(l).map((b) => <Badge key={b.label} {...b} />)}</View>
        <Text style={{ color: t.muted, fontSize: 12 }}>gefunden {ago(l.firstSeenAt)}</Text>

        {l.isPaywalled && (
          <View style={[styles.note, { backgroundColor: t.warnBg }]}>
            <Text style={{ color: t.warn, fontWeight: '600' }}>Bei ImmoScout24 noch exklusiv für Suchen+.</Text>
            <Text style={{ color: t.warn }}>
              {alternatives.length
                ? 'Dieselbe Wohnung haben wir auch hier gefunden – dort ohne Bezahlschranke kontaktieren:'
                : 'Wir suchen im Web nach derselben Wohnung auf anderen Portalen; Treffer erscheinen hier.'}
            </Text>
          </View>
        )}

        <Pressable onPress={() => WebBrowser.openBrowserAsync(l.url)} style={[styles.primary, { backgroundColor: t.accent }]}>
          <Text style={{ color: t.accentText, fontWeight: '700' }}>Zum Angebot bei {sourceName(l.source)}</Text>
        </Pressable>
        {alternatives.map((a) => (
          <Pressable key={a.url} onPress={() => WebBrowser.openBrowserAsync(a.url)} style={[styles.secondary, { borderColor: t.accent }]}>
            <Text style={{ color: t.accent, fontWeight: '600' }}>Auch bei {sourceName(a.source)}</Text>
          </Pressable>
        ))}

        <Text style={[styles.h, { color: t.text }]}>Merkliste</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {STATUSES.map((s) => (
            <Chip key={s.value} label={s.label} active={fav?.status === s.value} onPress={() => setFav.mutate(fav?.status === s.value ? null : s.value)} />
          ))}
        </View>

        <Text style={[styles.h, { color: t.text }]}>Eckdaten</Text>
        {facts(l)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <View key={k} style={[styles.fact, { borderColor: t.border }]}>
              <Text style={{ color: t.muted }}>{k}</Text>
              <Text style={{ color: t.text, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
            </View>
          ))}
        {l.excerpt && <Text style={{ color: t.muted, marginTop: 10 }}>{l.excerpt} …</Text>}
        <Text style={{ color: t.muted, fontSize: 11, marginTop: 12 }}>
          Angaben automatisch aus dem Inserat übernommen und ohne Gewähr. Maßgeblich ist das Original bei {sourceName(l.source)}.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  note: { padding: 10, borderRadius: 8, gap: 4, marginTop: 6 },
  primary: { padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  secondary: { padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1.5 },
  h: { fontSize: 16, fontWeight: '700', marginTop: 16 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
});
