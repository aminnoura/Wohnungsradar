import { describe, expect, it } from 'vitest';
import type { Listing } from './listing';
import { TenantProfileSchema, templateMessage } from './message';

const listing = (o: Partial<Listing>) => ({ title: 'Schöne Wohnung', rooms: 2, street: 'Weserstraße 5', ortsteil: 'Neukölln', city: 'Berlin', ...o }) as Listing;
const profile = TenantProfileSchema.parse({ name: 'Alex Muster', occupation: 'Pflegekraft', netIncome: 3000, hasWbs: true, wbsLevel: 140, moveInDate: 'ab sofort' });

describe('templateMessage', () => {
  it('is formal for regular flats and signs with the name', () => {
    const m = templateMessage(listing({}), profile);
    expect(m).toMatch(/^Sehr geehrte Damen und Herren/);
    expect(m).toContain('2-Zimmer-Wohnung (Weserstraße 5, Neukölln)');
    expect(m).toContain('3.000 €');
    expect(m.trim().endsWith('Alex Muster')).toBe(true);
  });

  it('uses du/ihr for WG rooms', () => {
    expect(templateMessage(listing({ isWgRoom: true }), profile)).toMatch(/^Hallo,[\s\S]*eure Anzeige/);
  });

  it('mentions the WBS only when the listing requires one', () => {
    expect(templateMessage(listing({ wbsRequired: true }), profile)).toContain('WBS 140');
    expect(templateMessage(listing({ wbsRequired: false }), profile)).not.toContain('WBS');
  });

  it('offers the current flat for swaps', () => {
    const p = { ...profile, currentFlat: { rooms: 2, sizeM2: 55, warmRent: 780, area: 'Neukölln' } };
    expect(templateMessage(listing({ isSwap: true }), p)).toContain('Zum Tausch biete ich meine Wohnung an: 2 Zimmer, 55 m², 780 € warm, Neukölln.');
  });

  it('writes English on request and omits facts the profile lacks', () => {
    const m = templateMessage(listing({}), TenantProfileSchema.parse({ name: 'Sam' }), 'en');
    expect(m).toMatch(/^Dear Sir or Madam/);
    expect(m).not.toMatch(/income|undefined|null/);
  });
});
