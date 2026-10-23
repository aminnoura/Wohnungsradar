import { BERLIN_BEZIRKE, CITIES } from '@wr/geo';
import { FILTER_DEFS, GROUP_LABELS, HEATING_TYPES, SOURCES, type FilterDef, type FilterGroup, type SearchFilters } from '@wr/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { useTheme, type Theme } from '@/components/theme';
import { useFilters } from '@/lib/filters';

type F = Record<string, unknown>;
const OPEN_BY_DEFAULT: FilterGroup[] = ['location', 'price', 'size', 'berlin'];
const GROUPS = Object.keys(GROUP_LABELS) as FilterGroup[];

const toNum = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() === '' || Number.isNaN(n) ? undefined : n;
};

function NumInput({ value, onChange, placeholder, t }: { value?: number; onChange: (n?: number) => void; placeholder: string; t: Theme }) {
  const [text, setText] = useState(value != null ? String(value) : '');
  return (
    <TextInput
      value={text}
      onChangeText={(s) => {
        setText(s);
        onChange(toNum(s));
      }}
      placeholder={placeholder}
      placeholderTextColor={t.muted}
      keyboardType="decimal-pad"
      style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }]}
    />
  );
}

function TextField({ value, onChange, placeholder, t }: { value?: string; onChange: (s?: string) => void; placeholder: string; t: Theme }) {
  return (
    <TextInput
      value={value ?? ''}
      onChangeText={(s) => onChange(s || undefined)}
      placeholder={placeholder}
      placeholderTextColor={t.muted}
      autoCapitalize="none"
      style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card, flex: 1 }]}
    />
  );
}

const toggle = (list: string[] | undefined, v: string) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]);

function Control({ def, f, set, t }: { def: FilterDef; f: F; set: (p: F) => void; t: Theme }) {
  const v = f[def.key];
  switch (def.kind) {
    case 'range': {
      const r = (v as { min?: number; max?: number }) ?? {};
      const unit = def.unit ? ` ${def.unit}` : '';
      return (
        <View style={styles.row}>
          <NumInput t={t} value={r.min} placeholder={`min${unit}`} onChange={(min) => set({ [def.key]: { ...r, min } })} />
          <Text style={{ color: t.muted }}>–</Text>
          <NumInput t={t} value={r.max} placeholder={`max${unit}`} onChange={(max) => set({ [def.key]: { ...r, max } })} />
        </View>
      );
    }
    case 'min':
    case 'max':
      return <NumInput t={t} value={v as number} placeholder={def.unit ?? ''} onChange={(n) => set({ [def.key]: n })} />;
    case 'bool':
      return <Switch value={!!v} onValueChange={(b) => set({ [def.key]: b || undefined })} />;
    case 'tri':
      return (
        <View style={styles.wrap}>
          {(['any', 'only', 'exclude'] as const).map((o) => (
            <Chip key={o} label={{ any: 'Egal', only: 'Nur', exclude: 'Ausblenden' }[o]} active={(v ?? 'any') === o} onPress={() => set({ [def.key]: o === 'any' ? undefined : o })} />
          ))}
        </View>
      );
    case 'select':
      return (
        <View style={styles.wrap}>
          {def.options.map((o) => (
            <Chip key={o.value} label={o.label} active={(v ?? def.options[0].value) === o.value} onPress={() => set({ [def.key]: o.value === 'any' ? undefined : o.value })} />
          ))}
        </View>
      );
    case 'custom':
      return <Custom def={def} f={f} set={set} t={t} />;
  }
}

function Custom({ def, f, set, t }: { def: Extract<FilterDef, { kind: 'custom' }>; f: F; set: (p: F) => void; t: Theme }) {
  const [allOrtsteile, setAllOrtsteile] = useState(false);
  const v = f[def.key];
  switch (def.key) {
    case 'city':
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip label="Ganz Deutschland" active={!v} onPress={() => set({ city: undefined, bezirke: undefined, ortsteile: undefined })} />
          {CITIES.map((c) => (
            <Chip key={c.slug} label={c.name} active={v === c.name} onPress={() => set({ city: c.name, bezirke: undefined, ortsteile: undefined, center: undefined })} />
          ))}
        </ScrollView>
      );
    case 'bezirke':
      if (f.city !== 'Berlin') return <Text style={{ color: t.muted }}>Nur für Berlin</Text>;
      return (
        <View style={styles.wrap}>
          {Object.keys(BERLIN_BEZIRKE).map((b) => (
            <Chip key={b} label={b} active={(v as string[] | undefined)?.includes(b)} onPress={() => set({ bezirke: toggle(v as string[], b) })} />
          ))}
        </View>
      );
    case 'ortsteile': {
      if (f.city !== 'Berlin') return <Text style={{ color: t.muted }}>Nur für Berlin</Text>;
      const chosen = (f.bezirke as string[] | undefined) ?? [];
      const bezirke = allOrtsteile || !chosen.length ? Object.keys(BERLIN_BEZIRKE) : chosen;
      return (
        <View>
          {!chosen.length && !allOrtsteile ? (
            <Pressable onPress={() => setAllOrtsteile(true)}>
              <Text style={{ color: t.accent }}>Alle 96 Ortsteile anzeigen</Text>
            </Pressable>
          ) : (
            bezirke.map((b) => (
              <View key={b} style={{ marginBottom: 6 }}>
                <Text style={{ color: t.muted, fontSize: 12, marginBottom: 4 }}>{b}</Text>
                <View style={styles.wrap}>
                  {BERLIN_BEZIRKE[b].map((o) => (
                    <Chip key={o} label={o} active={(v as string[] | undefined)?.includes(o)} onPress={() => set({ ortsteile: toggle(v as string[], o) })} />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      );
    }
    case 'plz':
      return (
        <TextField
          t={t}
          value={(v as string[] | undefined)?.join(', ')}
          placeholder="z. B. 10245, 10247"
          onChange={(s) => set({ plz: s?.split(/[\s,]+/).filter((x) => /^\d{5}$/.test(x)) })}
        />
      );
    case 'center': {
      const city = CITIES.find((c) => c.name === f.city);
      const c = v as { lat: number; lng: number; radiusKm: number } | undefined;
      if (!city) return <Text style={{ color: t.muted }}>Erst eine Stadt wählen</Text>;
      return (
        <View style={styles.row}>
          <NumInput t={t} value={c?.radiusKm} placeholder={`km um ${city.name}-Zentrum`} onChange={(km) => set({ center: km ? { lat: city.lat, lng: city.lng, radiusKm: km } : undefined })} />
        </View>
      );
    }
    case 'polygon':
      return v ? (
        <Pressable onPress={() => set({ polygon: undefined })}>
          <Text style={{ color: t.accent }}>Gezeichneten Bereich entfernen</Text>
        </Pressable>
      ) : (
        <Text style={{ color: t.muted }}>Im Tab „Karte“ → „Bereich zeichnen“</Text>
      );
    case 'sources':
      return (
        <View style={styles.wrap}>
          {SOURCES.map((s) => (
            <Chip key={s.id} label={s.name} active={(v as string[] | undefined)?.includes(s.id)} onPress={() => set({ sources: toggle(v as string[], s.id) })} />
          ))}
        </View>
      );
    case 'heatingTypes':
      return (
        <View style={styles.wrap}>
          {HEATING_TYPES.map((h) => (
            <Chip key={h} label={h} active={(v as string[] | undefined)?.includes(h)} onPress={() => set({ heatingTypes: toggle(v as string[], h) })} />
          ))}
        </View>
      );
    case 'availableBy':
      return <TextField t={t} value={v as string} placeholder="JJJJ-MM-TT" onChange={(s) => set({ availableBy: s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined })} />;
    case 'keywords':
      return <TextField t={t} value={v as string} placeholder="z. B. Altbau, Dielen" onChange={(s) => set({ keywords: s })} />;
    case 'excludeKeywords':
      return <TextField t={t} value={v as string} placeholder="z. B. Senioren, Gewerbe" onChange={(s) => set({ excludeKeywords: s })} />;
    default:
      if (def.input === 'bool') return <Switch value={!!v} onValueChange={(b) => set({ [def.key]: b || undefined })} />;
      if (def.input === 'number') return <NumInput t={t} value={v as number} placeholder="" onChange={(n) => set({ [def.key]: n })} />;
      return null;
  }
}

export default function FiltersScreen() {
  const t = useTheme();
  const { filters, set, reset } = useFilters();
  const [open, setOpen] = useState<Set<FilterGroup>>(new Set(OPEN_BY_DEFAULT));
  // Text inputs remount on reset so they don't keep stale local text.
  const [resetKey, setResetKey] = useState(0);
  const f = filters as F;
  const patch = (p: F) => set(p as Partial<SearchFilters>);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView key={resetKey} contentContainerStyle={{ padding: 12, paddingBottom: 100, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        {GROUPS.map((g) => {
          const defs = FILTER_DEFS.filter((d) => d.group === g);
          const isOpen = open.has(g);
          return (
            <View key={g} style={[styles.group, { backgroundColor: t.card, borderColor: t.border }]}>
              <Pressable
                onPress={() => setOpen((s) => { const n = new Set(s); n.has(g) ? n.delete(g) : n.add(g); return n; })}
                style={styles.groupHead}
              >
                <Text style={[styles.groupTitle, { color: t.text }]}>{GROUP_LABELS[g]}</Text>
                <Text style={{ color: t.muted }}>{isOpen ? '−' : `+ ${defs.length}`}</Text>
              </Pressable>
              {isOpen &&
                defs.map((def) => (
                  <View key={def.key} style={[styles.field, (def.kind === 'bool' || (def.kind === 'custom' && def.input === 'bool')) && styles.inline]}>
                    <Text style={[styles.label, { color: t.text }]}>{def.label}</Text>
                    <Control def={def} f={f} set={patch} t={t} />
                  </View>
                ))}
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: t.card, borderColor: t.border }]}>
        <Pressable onPress={() => { reset(); setResetKey((k) => k + 1); }} style={[styles.footBtn, { borderColor: t.border, borderWidth: 1 }]}>
          <Text style={{ color: t.text }}>Zurücksetzen</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={[styles.footBtn, { backgroundColor: t.accent, flex: 1 }]}>
          <Text style={{ color: t.accentText, fontWeight: '700' }}>Ergebnisse anzeigen</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderWidth: 1, borderRadius: 10, marginBottom: 10, paddingHorizontal: 12 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  groupTitle: { fontSize: 16, fontWeight: '700' },
  field: { paddingVertical: 8 },
  inline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minWidth: 110, fontSize: 15 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1 },
  footBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
});
