import { useMutation, useQuery } from '@tanstack/react-query';
import { isProfileUsable, templateMessage, type Listing, type MessageLang } from '@wr/shared';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '@/lib/api';
import { useProfile } from '@/lib/profile';
import { Chip } from './Chip';
import { useTheme } from './theme';

/**
 * Suggested first message to the landlord. Shows the local template at once, then the server's
 * (Claude-written, if configured) version. Editable; copy it into the portal's contact form.
 */
export function ContactMessage({ listing, onContacted }: { listing: Listing; onContacted: () => void }) {
  const t = useTheme();
  const profile = useProfile((s) => s.profile);
  const [lang, setLang] = useState<MessageLang>('de');
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const ready = isProfileUsable(profile);

  const q = useQuery({
    queryKey: ['message', listing.id, lang, profile],
    queryFn: () => api.message(listing.id, profile, lang),
    enabled: ready,
    staleTime: Infinity,
  });
  const again = useMutation({ mutationFn: () => api.message(listing.id, profile, lang, true), onSuccess: (r) => setText(r.text) });

  useEffect(() => {
    if (!ready) return;
    setText(q.data?.text ?? templateMessage(listing, profile, lang));
  }, [q.data, ready, listing, profile, lang]);

  if (!ready) {
    return (
      <View style={[styles.box, { borderColor: t.border, backgroundColor: t.card }]}>
        <Text style={{ color: t.text }}>Fülle einmal dein Bewerberprofil aus – dann schlagen wir für jede Wohnung eine passende Nachricht an den Anbieter vor.</Text>
        <Pressable onPress={() => router.push('/profile')} style={[styles.btn, { backgroundColor: t.accent }]}>
          <Text style={{ color: t.accentText, fontWeight: '700' }}>Profil ausfüllen</Text>
        </Pressable>
      </View>
    );
  }

  const copy = async (markContacted: boolean) => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (markContacted) onContacted();
  };
  const loading = q.isFetching || again.isPending;

  return (
    <View style={[styles.box, { borderColor: t.border, backgroundColor: t.card }]}>
      <View style={styles.row}>
        <Chip label="Deutsch" active={lang === 'de'} onPress={() => setLang('de')} />
        <Chip label="English" active={lang === 'en'} onPress={() => setLang('en')} />
        <View style={{ flex: 1 }} />
        {loading ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text style={{ color: t.muted, fontSize: 11 }}>{(again.data ?? q.data)?.source === 'claude' ? 'Vorschlag von Claude' : 'Vorlage'}</Text>
        )}
      </View>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
      />
      <View style={styles.row}>
        <Pressable onPress={() => copy(true)} style={[styles.btn, { backgroundColor: t.accent, flex: 1 }]}>
          <Text style={{ color: t.accentText, fontWeight: '700' }}>{copied ? 'Kopiert ✓' : 'Kopieren & als angefragt markieren'}</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Pressable onPress={() => copy(false)} style={[styles.btn, styles.ghost, { borderColor: t.border }]}>
          <Text style={{ color: t.text }}>Nur kopieren</Text>
        </Pressable>
        <Pressable onPress={() => again.mutate()} disabled={loading} style={[styles.btn, styles.ghost, { borderColor: t.border }]}>
          <Text style={{ color: t.text }}>Neu formulieren</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/profile')} style={[styles.btn, styles.ghost, { borderColor: t.border }]}>
          <Text style={{ color: t.text }}>Profil</Text>
        </Pressable>
      </View>
      <Text style={{ color: t.muted, fontSize: 12 }}>Füge die Nachricht im Kontaktformular des Inserats ein. Prüfe sie vorher kurz.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 220, fontSize: 14, lineHeight: 20, textAlignVertical: 'top' },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center' },
  ghost: { borderWidth: 1 },
});
