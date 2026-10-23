import { describe, expect, it } from 'vitest';
import { extractFromText, parseNumber, parseRooms, parseSize } from '../src/parse';

describe('parseNumber', () => {
  it.each([
    ['1.599', 1599],
    ['758,28', 758.28],
    ['1.970,16', 1970.16],
    ['1,790', 1790],
    ['2,0', 2],
    ['51,76', 51.76],
    ['2.943', 2943],
    ['136.86', 136.86],
  ])('%s → %d', (s, n) => expect(parseNumber(s)).toBe(n));
});

describe('size & rooms', () => {
  it('reads sizes in various spellings', () => {
    expect(parseSize('…luxuriöse...114 m² · 4 Zi.2.980 €')).toBe(114);
    expect(parseSize('Wohnfläche: 51,76 m²')).toBe(51.76);
    expect(parseSize('Röbellweg 4/6 129,54 qm 13125 Berlin')).toBe(129.54);
    expect(parseSize('Preis/m²: 26,75 €/m² Wohnfläche ca.: 110 m²')).toBe(110);
  });
  it('reads rooms', () => {
    expect(parseRooms('€1,790per month3 Rooms3 adults73 m²')).toBe(3);
    expect(parseRooms('1,5-Zimmer-Wohnung mit Balkon')).toBe(1.5);
    expect(parseRooms('Zimmeranzahl: 2,0 Wohnfläche')).toBe(2);
    expect(parseRooms('114 m² · 4 Zi.2.980 €')).toBe(4);
  });
});

describe('extractFromText', () => {
  it('parses an inberlinwohnen detail block', () => {
    const x = extractFromText(
      'Adresse: Huronseestraße 80, 10319, Lichtenberg Zimmeranzahl: 3,0 Wohnfläche: 68,99 m² Kaltmiete: 480,38 € Nebenkosten: 106,00 € ' +
        'Gesamtmiete: 680,38 € Bezugsfertig ab: 01.11.2026 WBS: erforderlich Etage: 2 von (insg. 5) Badezimmer: 1 Baujahr: 1977 Heizung: Zentralheizung Balkon Keller',
    );
    expect(x).toMatchObject({
      coldRent: 480.38, warmRent: 680.38, extraCosts: 106, sizeM2: 68.99, rooms: 3, wbsRequired: true,
      availableFrom: '2026-11-01', floor: 2, totalFloors: 5, bathrooms: 1, yearBuilt: 1977, heatingType: 'Zentralheizung', balcony: true, cellar: true,
    });
  });

  it('labels after the amount (degewo/WBM style)', () => {
    expect(extractFromText('1.970,16 €Warmmiete 112,53 m²Größe 4Zimmer')).toMatchObject({ warmRent: 1970.16, sizeM2: 112.53, rooms: 4 });
  });

  it.each([
    ['WBS: nicht erforderlich', false],
    ['ohne WBS', false],
    ['kein WBS notwendig', false],
    ['WBS erforderlich', true],
    ['nur mit WBS', true],
    ['Schicke Singlewohnung im Erstbezug / WBS 220', true],
    ['WBS 140 erforderlich', true],
    ['Schöne Wohnung mit Balkon', undefined],
  ])('WBS: %s → %s', (text, expected) => expect(extractFromText(text).wbsRequired).toBe(expected));

  it('reads WBS level', () => {
    expect(extractFromText('Neubau im Erstbezug / WBS 180').wbsLevel).toBe(180);
  });

  it.each([
    ['Biete Tauschwohnung in Neukölln', true],
    ['Wohnungstausch: 2 Zimmer gegen 3', true],
    ['Kein Tausch!', false],
    ['Nachmieter gesucht', undefined],
  ])('Tausch: %s → %s', (text, expected) => expect(extractFromText(text).isSwap).toBe(expected));

  it('prefers the energy source over the distribution for heating', () => {
    expect(extractFromText('Heizung: FußbodenheizungFernwärme').heatingType).toBe('Fernwärme');
  });

  it('handles negations', () => {
    expect(extractFromText('Keine Haustiere. Kein Aufzug.')).toMatchObject({ petsAllowed: false, elevator: false });
    expect(extractFromText('Haustiere erlaubt, Aufzug vorhanden')).toMatchObject({ petsAllowed: true, elevator: true });
  });

  it('uses the portal default for an unlabeled price', () => {
    expect(extractFromText('980 € pro Monat', { priceIs: 'warm' }).warmRent).toBe(980);
    expect(extractFromText('2.069 € 10405 Berlin', { priceIs: 'cold' }).coldRent).toBe(2069);
  });

  it('detects furnished, sublet and limited term', () => {
    const x = extractFromText('möbliert, Zwischenmiete 30.10.2026 - 08.11.2026');
    expect(x).toMatchObject({ furnished: 'full', isSublet: true, limitedTerm: true });
    expect(extractFromText('unbefristet, unmöbliert')).toMatchObject({ limitedTerm: false, furnished: 'none' });
  });
});
