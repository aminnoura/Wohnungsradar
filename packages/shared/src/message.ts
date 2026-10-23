import { z } from 'zod';
import type { Listing } from './listing';

/** What a landlord wants to know about an applicant. Stored on the device; sent only when generating a message. */
export const TenantProfileSchema = z.object({
  name: z.string().max(80).default(''),
  phone: z.string().max(40).optional(),
  occupation: z.string().max(120).optional(),
  employer: z.string().max(120).optional(),
  /** Net household income per month in €. */
  netIncome: z.number().nonnegative().optional(),
  adults: z.number().int().min(1).max(10).default(1),
  children: z.number().int().min(0).max(10).default(0),
  moveInDate: z.string().max(40).optional(),
  hasWbs: z.boolean().default(false),
  wbsLevel: z.number().int().optional(),
  pets: z.string().max(80).optional(),
  smoker: z.boolean().default(false),
  schufaOk: z.boolean().default(true),
  languages: z.string().max(80).optional(),
  about: z.string().max(600).optional(),
  /** For Tauschwohnungen: the flat offered in exchange. */
  currentFlat: z
    .object({ rooms: z.number().optional(), sizeM2: z.number().optional(), warmRent: z.number().optional(), area: z.string().max(80).optional() })
    .optional(),
});

export type TenantProfile = z.infer<typeof TenantProfileSchema>;
export type MessageLang = 'de' | 'en';

export const isProfileUsable = (p: Partial<TenantProfile> | null | undefined) => !!p?.name?.trim();

/** WG rooms are informal ("du/ihr"); everything else formal ("Sie"). */
export const isInformal = (l: Pick<Listing, 'isWgRoom'>) => !!l.isWgRoom;

const eur = (n: number) => `${Math.round(n).toLocaleString('de-DE')} €`;

/**
 * Deterministic fallback message (no LLM). Covers the facts landlords ask for first: who moves in,
 * income, move-in date, WBS when required, and for swaps the flat offered in return.
 */
export function templateMessage(l: Listing, p: TenantProfile, lang: MessageLang = 'de'): string {
  const where = [l.street, l.ortsteil ?? l.city].filter(Boolean).join(', ');
  const flat = [l.rooms && `${String(l.rooms).replace('.', ',')}-Zimmer-Wohnung`, where && `(${where})`].filter(Boolean).join(' ') || 'Wohnung';
  const people = p.adults + p.children;
  const job = [p.occupation, p.employer && (lang === 'de' ? `bei ${p.employer}` : `at ${p.employer}`)].filter(Boolean).join(' ');

  if (lang === 'en') {
    const lines = [
      isInformal(l) ? 'Hi,' : 'Dear Sir or Madam,',
      `I am very interested in your ${l.isWgRoom ? 'room' : 'apartment'} "${l.title}"${where ? ` in ${where}` : ''}.`,
      [
        `My name is ${p.name}${job ? `, I work as ${job}` : ''}.`,
        people > 1 ? `We are ${people} people (${p.adults} adult${p.adults > 1 ? 's' : ''}${p.children ? `, ${p.children} child${p.children > 1 ? 'ren' : ''}` : ''}).` : 'I would live there alone.',
        p.netIncome ? `Our net household income is ${eur(p.netIncome)} per month.` : '',
        l.wbsRequired && p.hasWbs ? `I hold a valid WBS${p.wbsLevel ? ` ${p.wbsLevel}` : ''}.` : '',
        l.isSwap && p.currentFlat ? swapLine(p, 'en') : '',
        p.moveInDate ? `I could move in ${p.moveInDate}.` : '',
        [p.smoker ? '' : 'Non-smoker', p.pets ? `pets: ${p.pets}` : 'no pets', p.schufaOk ? 'clean SCHUFA' : ''].filter(Boolean).join(', ') + '.',
      ].filter(Boolean).join(' '),
      p.about ?? '',
      `I would be happy to arrange a viewing and can send all documents right away.`,
      `Best regards,\n${p.name}${p.phone ? `\n${p.phone}` : ''}`,
    ];
    return lines.filter(Boolean).join('\n\n');
  }

  const du = isInformal(l);
  const lines = [
    du ? 'Hallo,' : 'Sehr geehrte Damen und Herren,',
    `mit großem Interesse habe ich ${du ? 'eure' : 'Ihre'} Anzeige für ${l.isWgRoom ? 'das WG-Zimmer' : `die ${flat}`} gelesen.`,
    [
      `Ich heiße ${p.name}${job ? ` und arbeite als ${job}` : ''}.`,
      people > 1
        ? `Wir sind ${people} Personen (${p.adults} Erwachsene${p.children ? `, ${p.children} Kind${p.children > 1 ? 'er' : ''}` : ''}).`
        : l.isWgRoom ? '' : 'Ich würde allein einziehen.',
      p.netIncome ? `Unser Nettohaushaltseinkommen beträgt ${eur(p.netIncome)} im Monat.` : '',
      l.wbsRequired && p.hasWbs ? `Ein gültiger WBS${p.wbsLevel ? ` ${p.wbsLevel}` : ''} liegt vor.` : '',
      l.isSwap && p.currentFlat ? swapLine(p, 'de') : '',
      p.moveInDate ? `Einziehen könnte ich ${p.moveInDate}.` : '',
      [p.smoker ? '' : 'Nichtraucher', p.pets ? `Haustiere: ${p.pets}` : 'keine Haustiere', p.schufaOk ? 'SCHUFA ohne Einträge' : ''].filter(Boolean).join(', ') + '.',
    ].filter(Boolean).join(' '),
    p.about ?? '',
    du
      ? 'Ich würde mich sehr freuen, euch kennenzulernen!'
      : 'Über eine Einladung zur Besichtigung würde ich mich sehr freuen. Alle Unterlagen (Einkommensnachweise, SCHUFA, Mietschuldenfreiheit) kann ich sofort zusenden.',
    `${du ? 'Viele Grüße' : 'Mit freundlichen Grüßen'}\n${p.name}${p.phone ? `\n${p.phone}` : ''}`,
  ];
  return lines.filter(Boolean).join('\n\n');
}

function swapLine(p: TenantProfile, lang: MessageLang): string {
  const f = p.currentFlat!;
  const parts = [f.rooms && `${f.rooms} ${lang === 'de' ? 'Zimmer' : 'rooms'}`, f.sizeM2 && `${f.sizeM2} m²`, f.warmRent && `${eur(f.warmRent)} ${lang === 'de' ? 'warm' : 'incl. utilities'}`, f.area]
    .filter(Boolean)
    .join(', ');
  return lang === 'de' ? `Zum Tausch biete ich meine Wohnung an: ${parts}.` : `In exchange I offer my apartment: ${parts}.`;
}
