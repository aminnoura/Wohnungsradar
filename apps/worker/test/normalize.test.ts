import { describe, expect, it } from 'vitest';
import { detectBerlinArea } from '@wr/geo';
import { normalize, parseStreet } from '../src/normalize';

describe('parseStreet', () => {
  it.each([
    ['Platz für zwei Hellersdorfer Straße 91B, 12619 Berlin', 'Hellersdorfer Straße 91B'],
    ['Wohnen mit Service für Senioren Finkenkruger Straße 90 | Falkensee', 'Finkenkruger Straße 90'],
    ['Huronseestraße 80, 10319 Lichtenberg', 'Huronseestraße 80'],
    ['Karl-Marx-Allee 5, 10178 Berlin', 'Karl-Marx-Allee 5'],
    ['Holländer Str. 38, 13407 Berlin', 'Holländer Str. 38'],
    ['Röbellweg 4/6 129,54 qm', 'Röbellweg 4/6'],
    ['12043 Berlin, Neukölln', null],
    ['Vermietung nur mit WBS A Untere Dorfstr. 93, 50829 Köln', 'Untere Dorfstr. 93'],
    ['Wohnung Alte Jakobstraße 12, 10969 Berlin', 'Alte Jakobstraße 12'],
    ['Zwei-Zimmer-Wohnung mit Loggia Am Georgshof 9, 50765 Köln', 'Am Georgshof 9'],
    ['Wohnen An der Wuhlheide 3, 12459 Berlin', 'An der Wuhlheide 3'],
    ['2-Zimmer Wohnung in Grumme mit WBS Weserstraße 16, 44807 Bochum', 'Weserstraße 16'],
  ])('%s', (addr, street) => expect(parseStreet(addr)).toBe(street));
});

describe('detectBerlinArea', () => {
  it.each([
    ['12207 Berlin/Steglitz-Zehlendorf', 'Steglitz-Zehlendorf', null],
    ['Märkische Allee 200 | Marzahn Mitte', 'Marzahn-Hellersdorf', 'Marzahn'],
    ['10405 Berlin (Prenzlauer Berg)', 'Pankow', 'Prenzlauer Berg'],
    ['13409 Berlin - Reinickendorf', 'Reinickendorf', 'Reinickendorf'],
    ['Wohnung in Neu-Hohenschönhausen', 'Lichtenberg', 'Neu-Hohenschönhausen'],
    ['Charlottenburg-Nord, Berlin', 'Charlottenburg-Wilmersdorf', 'Charlottenburg-Nord'],
    ['Weißensee', 'Pankow', 'Weißensee'],
  ])('%s', (text, bezirk, ortsteil) => expect(detectBerlinArea(text)).toEqual({ bezirk, ortsteil }));
});

describe('normalize', () => {
  it('assigns non-Berlin towns from "Street | Town" addresses', () => {
    const row = normalize(
      { source: 'degewo', sourceId: 'x', url: 'https://x', title: 'Seniorenwohnung', address: 'Finkenkruger Straße 90 | Falkensee', text: '863,50 € Warmmiete 1 Zimmer 32,08 m²' },
      { extract: { priceIs: 'warm' } },
      'Berlin',
    );
    expect(row).toMatchObject({ city: 'Falkensee', bezirk: null, street: 'Finkenkruger Straße 90', warmRent: 863.5, sizeM2: 32.08, rooms: 1 });
  });

  it('structured fields from JSON sources win over text extraction', () => {
    const row = normalize(
      { source: 'howoge', sourceId: '1', url: 'https://x', title: 'Wohnung', text: 'WBS erforderlich', address: 'Franz-Schmidt-Straße 13, 13125 Berlin', fields: { wbsRequired: false, warmRent: 1053 } },
      {},
      'Berlin',
    );
    // No district in the address: bezirk stays null here and is filled by the geocoder.
    expect(row).toMatchObject({ wbsRequired: false, warmRent: 1053, plz: '13125', city: 'Berlin', street: 'Franz-Schmidt-Straße 13', bezirk: null });
  });
});
