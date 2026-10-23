export type SourceKind = 'portal' | 'public-housing' | 'cooperative' | 'landlord' | 'swap' | 'furnished' | 'discovery';
/** direct = we fetch the site's own list page/JSON; brave = found via Brave Search `site:` queries. */
export type SourceMethod = 'direct' | 'brave';

export interface SourceInfo {
  id: string;
  name: string;
  homepage: string;
  kind: SourceKind;
  method: SourceMethod;
  /** 'berlin' = Berlin(-area) only; 'de' = Germany-wide. */
  coverage: 'berlin' | 'de';
}

export const SOURCES: SourceInfo[] = [
  { id: 'immoscout24', name: 'ImmoScout24', homepage: 'https://www.immobilienscout24.de', kind: 'portal', method: 'direct', coverage: 'de' },
  { id: 'kleinanzeigen', name: 'Kleinanzeigen', homepage: 'https://www.kleinanzeigen.de', kind: 'portal', method: 'direct', coverage: 'de' },
  { id: 'wggesucht', name: 'WG-Gesucht', homepage: 'https://www.wg-gesucht.de', kind: 'portal', method: 'direct', coverage: 'de' },
  { id: 'ohnemakler', name: 'Ohne-Makler', homepage: 'https://www.ohne-makler.net', kind: 'portal', method: 'direct', coverage: 'de' },
  { id: 'immowelt', name: 'Immowelt / Immonet', homepage: 'https://www.immowelt.de', kind: 'portal', method: 'brave', coverage: 'de' },
  { id: 'meinestadt', name: 'meinestadt.de', homepage: 'https://www.meinestadt.de', kind: 'portal', method: 'brave', coverage: 'de' },

  { id: 'inberlinwohnen', name: 'inberlinwohnen', homepage: 'https://inberlinwohnen.de', kind: 'public-housing', method: 'direct', coverage: 'berlin' },
  { id: 'degewo', name: 'degewo', homepage: 'https://www.degewo.de', kind: 'public-housing', method: 'direct', coverage: 'berlin' },
  { id: 'gewobag', name: 'Gewobag', homepage: 'https://www.gewobag.de', kind: 'public-housing', method: 'direct', coverage: 'berlin' },
  { id: 'howoge', name: 'HOWOGE', homepage: 'https://www.howoge.de', kind: 'public-housing', method: 'direct', coverage: 'berlin' },
  { id: 'wbm', name: 'WBM', homepage: 'https://www.wbm.de', kind: 'public-housing', method: 'direct', coverage: 'berlin' },
  { id: 'gesobau', name: 'Gesobau', homepage: 'https://www.gesobau.de', kind: 'public-housing', method: 'direct', coverage: 'berlin' },
  { id: 'stadtundland', name: 'Stadt und Land', homepage: 'https://www.stadtundland.de', kind: 'public-housing', method: 'direct', coverage: 'berlin' },
  { id: 'berlinovo', name: 'Berlinovo', homepage: 'https://www.berlinovo.de', kind: 'public-housing', method: 'brave', coverage: 'berlin' },

  { id: 'charlotte1907', name: 'Charlottenburger Baugenossenschaft', homepage: 'https://charlotte1907.de', kind: 'cooperative', method: 'direct', coverage: 'berlin' },

  { id: 'grandcity', name: 'Grand City Property', homepage: 'https://www.grandcityproperty.de', kind: 'landlord', method: 'direct', coverage: 'de' },
  { id: 'buwog', name: 'BUWOG', homepage: 'https://www.buwog.de', kind: 'landlord', method: 'brave', coverage: 'de' },
  { id: 'gagkoeln', name: 'GAG Köln', homepage: 'https://www.gag-koeln.de', kind: 'public-housing', method: 'direct', coverage: 'de' },
  { id: 'swd', name: 'SWD Düsseldorf', homepage: 'https://www.swd-duesseldorf.de', kind: 'public-housing', method: 'direct', coverage: 'de' },
  { id: 'vbw', name: 'VBW Bochum', homepage: 'https://www.vbw-bochum.de', kind: 'public-housing', method: 'direct', coverage: 'de' },
  { id: 'wbgnuernberg', name: 'wbg Nürnberg', homepage: 'https://wbg.nuernberg.de', kind: 'public-housing', method: 'direct', coverage: 'de' },
  { id: 'adler', name: 'Adler Group', homepage: 'https://www.adler-group.com', kind: 'landlord', method: 'direct', coverage: 'de' },
  { id: 'vonovia', name: 'Vonovia', homepage: 'https://www.vonovia.de', kind: 'landlord', method: 'brave', coverage: 'de' },
  { id: 'deutschewohnen', name: 'Deutsche Wohnen', homepage: 'https://www.deutsche-wohnen.com', kind: 'landlord', method: 'brave', coverage: 'de' },
  { id: 'heimstaden', name: 'Heimstaden', homepage: 'https://heimstaden.de', kind: 'landlord', method: 'brave', coverage: 'de' },
  { id: 'covivio', name: 'Covivio', homepage: 'https://www.covivio.immo', kind: 'landlord', method: 'brave', coverage: 'de' },

  { id: 'tauschwohnung', name: 'Tauschwohnung', homepage: 'https://www.tauschwohnung.com', kind: 'swap', method: 'brave', coverage: 'de' },

  { id: 'wunderflats', name: 'Wunderflats', homepage: 'https://wunderflats.com', kind: 'furnished', method: 'direct', coverage: 'de' },
  { id: 'housinganywhere', name: 'HousingAnywhere', homepage: 'https://housinganywhere.com', kind: 'furnished', method: 'direct', coverage: 'de' },

  { id: 'web', name: 'Web (Brave)', homepage: 'https://search.brave.com', kind: 'discovery', method: 'brave', coverage: 'de' },
];

export const SOURCE_BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
