import type { Listing } from '@wr/shared';
import { SOURCE_BY_ID } from '@wr/shared';

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export const formatEur = (n: number | null | undefined) => (n == null ? '–' : eur.format(n));

export function priceLine(l: Listing): string {
  if (l.warmRent != null && l.coldRent != null) return `${formatEur(l.coldRent)} kalt · ${formatEur(l.warmRent)} warm`;
  if (l.warmRent != null) return `${formatEur(l.warmRent)} warm`;
  if (l.coldRent != null) return `${formatEur(l.coldRent)} kalt`;
  return 'Preis auf Anfrage';
}

export function factsLine(l: Listing): string {
  return [
    l.rooms != null && `${String(l.rooms).replace('.', ',')} Zi.`,
    l.sizeM2 != null && `${Math.round(l.sizeM2)} m²`,
    l.floor != null && (l.floor === 0 ? 'EG' : `${l.floor}. OG`),
  ].filter(Boolean).join(' · ');
}

export const placeLine = (l: Listing) => [l.ortsteil ?? l.bezirk, l.city].filter(Boolean).join(', ') || '–';

export const sourceName = (id: string) => SOURCE_BY_ID[id]?.name ?? id;

export function ago(iso: string | null | undefined): string {
  if (!iso) return '';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} Tg.`;
}

/** Badges that matter most when scanning Berlin listings. */
export function badges(l: Listing): { label: string; tone: 'warn' | 'info' | 'good' }[] {
  const b: { label: string; tone: 'warn' | 'info' | 'good' }[] = [];
  if (l.wbsRequired) b.push({ label: l.wbsLevel ? `WBS ${l.wbsLevel}` : 'WBS', tone: 'warn' });
  if (l.wbsRequired === false) b.push({ label: 'ohne WBS', tone: 'good' });
  if (l.isSwap) b.push({ label: 'Tausch', tone: 'info' });
  if (l.isWgRoom) b.push({ label: 'WG-Zimmer', tone: 'info' });
  if (l.isSublet || l.limitedTerm) b.push({ label: 'befristet', tone: 'info' });
  if (l.furnished === 'full' || l.furnished === 'partly') b.push({ label: 'möbliert', tone: 'info' });
  if (l.isPaywalled) b.push({ label: 'Suchen+', tone: 'warn' });
  return b;
}
