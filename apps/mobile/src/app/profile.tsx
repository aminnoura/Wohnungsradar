import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useTheme, type Theme } from '@/components/theme';
import { useProfile } from '@/lib/profile';

const num = (s: string) => {
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return s.trim() === '' || Number.isNaN(n) ? undefined : n;
};

function Field({ label, hint, t, children }: { label: string; hint?: string; t: Theme; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={{ color: t.text, fontSize: 14 }}>{label}</Text>
      {hint && <Text style={{ color: t.muted, fontSize: 12, marginBottom: 4 }}>{hint}</Text>}
      {children}
    </View>
  );
}

function Input({ value, onChange, t, numeric, multiline, placeholder }: { value?: string | number; onChange: (s: string) => void; t: Theme; numeric?: boolean; multiline?: boolean; placeholder?: string }) {
  const [text, setText] = useState(value != null ? String(value) : '');
  return (
    <TextInput
      value={text}
      onChangeText={(s) => {
        setText(s);
        onChange(s);
      }}
      placeholder={placeholder}
      placeholderTextColor={t.muted}
      keyboardType={numeric ? 'numeric' : 'default'}
      multiline={multiline}
      style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
    />
  );
}

/** Applicant details used to write contact messages. Stored only on this device. */
export default function ProfileScreen() {
  const t = useTheme();
  const { profile: p, set } = useProfile();
  const flat = p.currentFlat ?? {};
  const setFlat = (patch: Partial<typeof flat>) => set({ currentFlat: { ...flat, ...patch } });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, maxWidth: 700, width: '100%', alignSelf: 'center' }}>
      <Text style={{ color: t.muted, marginBottom: 12 }}>
        Daraus schreiben wir für jede Wohnung eine passende Nachricht an den Anbieter. Die Angaben bleiben auf diesem Gerät und werden nur beim Erstellen einer Nachricht mitgeschickt.
      </Text>
      <Field t={t} label="Name *"><Input t={t} value={p.name} onChange={(name) => set({ name })} placeholder="Vor- und Nachname" /></Field>
      <Field t={t} label="Telefon"><Input t={t} value={p.phone} onChange={(phone) => set({ phone: phone || undefined })} /></Field>
      <Field t={t} label="Beruf"><Input t={t} value={p.occupation} onChange={(occupation) => set({ occupation: occupation || undefined })} placeholder="z. B. Softwareentwickler" /></Field>
      <Field t={t} label="Arbeitgeber"><Input t={t} value={p.employer} onChange={(employer) => set({ employer: employer || undefined })} /></Field>
      <Field t={t} label="Nettohaushaltseinkommen (€/Monat)"><Input t={t} numeric value={p.netIncome} onChange={(s) => set({ netIncome: num(s) })} /></Field>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field t={t} label="Erwachsene"><Input t={t} numeric value={p.adults} onChange={(s) => set({ adults: Math.max(1, num(s) ?? 1) })} /></Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field t={t} label="Kinder"><Input t={t} numeric value={p.children} onChange={(s) => set({ children: num(s) ?? 0 })} /></Field>
        </View>
      </View>
      <Field t={t} label="Einzug" hint="frei formuliert, z. B. „ab 1. Dezember“ oder „flexibel“"><Input t={t} value={p.moveInDate} onChange={(moveInDate) => set({ moveInDate: moveInDate || undefined })} /></Field>
      <View style={[styles.switchRow]}>
        <Text style={{ color: t.text, flex: 1 }}>WBS vorhanden</Text>
        <Switch value={p.hasWbs} onValueChange={(hasWbs) => set({ hasWbs })} />
      </View>
      {p.hasWbs && <Field t={t} label="WBS-Stufe" hint="100, 140, 160, 180 oder 220"><Input t={t} numeric value={p.wbsLevel} onChange={(s) => set({ wbsLevel: num(s) })} /></Field>}
      <View style={styles.switchRow}>
        <Text style={{ color: t.text, flex: 1 }}>Raucher</Text>
        <Switch value={p.smoker} onValueChange={(smoker) => set({ smoker })} />
      </View>
      <View style={styles.switchRow}>
        <Text style={{ color: t.text, flex: 1 }}>SCHUFA ohne Einträge</Text>
        <Switch value={p.schufaOk} onValueChange={(schufaOk) => set({ schufaOk })} />
      </View>
      <Field t={t} label="Haustiere" hint="leer = keine"><Input t={t} value={p.pets} onChange={(pets) => set({ pets: pets || undefined })} /></Field>
      <Field t={t} label="Sprachen"><Input t={t} value={p.languages} onChange={(languages) => set({ languages: languages || undefined })} placeholder="z. B. Deutsch, Englisch, Persisch" /></Field>
      <Field t={t} label="Über mich" hint="1–3 Sätze: was dich als Mieter ausmacht"><Input t={t} multiline value={p.about} onChange={(about) => set({ about: about || undefined })} /></Field>

      <Text style={[styles.h, { color: t.text }]}>Für Tauschwohnungen: meine jetzige Wohnung</Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}><Field t={t} label="Zimmer"><Input t={t} numeric value={flat.rooms} onChange={(s) => setFlat({ rooms: num(s) })} /></Field></View>
        <View style={{ flex: 1 }}><Field t={t} label="m²"><Input t={t} numeric value={flat.sizeM2} onChange={(s) => setFlat({ sizeM2: num(s) })} /></Field></View>
        <View style={{ flex: 1 }}><Field t={t} label="Warmmiete €"><Input t={t} numeric value={flat.warmRent} onChange={(s) => setFlat({ warmRent: num(s) })} /></Field></View>
      </View>
      <Field t={t} label="Lage"><Input t={t} value={flat.area} onChange={(area) => setFlat({ area: area || undefined })} placeholder="z. B. Neukölln, Nähe Hermannplatz" /></Field>

      <Pressable onPress={() => router.back()} style={[styles.done, { backgroundColor: t.accent }]}>
        <Text style={{ color: t.accentText, fontWeight: '700' }}>Fertig</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  h: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  done: { padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
});
