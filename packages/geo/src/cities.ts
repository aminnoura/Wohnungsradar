/** Cities the crawler can target. Per-portal identifiers live here so adapters stay generic. */
export interface City {
  slug: string;
  name: string;
  state: string; // slug as used by ImmoScout24 / Ohne-Makler URLs
  lat: number;
  lng: number;
  /** WG-Gesucht numeric city id (only verified ids; missing = adapter skips this city). */
  wgGesuchtId?: number;
}

export const CITIES: City[] = [
  { slug: 'berlin', name: 'Berlin', state: 'berlin', lat: 52.52, lng: 13.405, wgGesuchtId: 8 },
  { slug: 'hamburg', name: 'Hamburg', state: 'hamburg', lat: 53.551, lng: 9.993, wgGesuchtId: 55 },
  { slug: 'muenchen', name: 'München', state: 'bayern', lat: 48.137, lng: 11.575, wgGesuchtId: 90 },
  { slug: 'koeln', name: 'Köln', state: 'nordrhein-westfalen', lat: 50.938, lng: 6.96, wgGesuchtId: 73 },
  { slug: 'frankfurt-am-main', name: 'Frankfurt am Main', state: 'hessen', lat: 50.11, lng: 8.682, wgGesuchtId: 41 },
  { slug: 'stuttgart', name: 'Stuttgart', state: 'baden-wuerttemberg', lat: 48.776, lng: 9.183, wgGesuchtId: 124 },
  { slug: 'duesseldorf', name: 'Düsseldorf', state: 'nordrhein-westfalen', lat: 51.227, lng: 6.774, wgGesuchtId: 30 },
  { slug: 'leipzig', name: 'Leipzig', state: 'sachsen', lat: 51.34, lng: 12.375, wgGesuchtId: 77 },
  { slug: 'dresden', name: 'Dresden', state: 'sachsen', lat: 51.05, lng: 13.738, wgGesuchtId: 27 },
  { slug: 'hannover', name: 'Hannover', state: 'niedersachsen', lat: 52.375, lng: 9.732 },
  { slug: 'potsdam', name: 'Potsdam', state: 'brandenburg', lat: 52.39, lng: 13.065 },
  { slug: 'nuernberg', name: 'Nürnberg', state: 'bayern', lat: 49.452, lng: 11.077 },
  { slug: 'bremen', name: 'Bremen', state: 'bremen', lat: 53.079, lng: 8.802 },
  { slug: 'essen', name: 'Essen', state: 'nordrhein-westfalen', lat: 51.456, lng: 7.012 },
  { slug: 'dortmund', name: 'Dortmund', state: 'nordrhein-westfalen', lat: 51.514, lng: 7.468 },
  { slug: 'bonn', name: 'Bonn', state: 'nordrhein-westfalen', lat: 50.737, lng: 7.098 },
  { slug: 'mannheim', name: 'Mannheim', state: 'baden-wuerttemberg', lat: 49.487, lng: 8.466 },
  { slug: 'karlsruhe', name: 'Karlsruhe', state: 'baden-wuerttemberg', lat: 49.007, lng: 8.404 },
  { slug: 'freiburg-im-breisgau', name: 'Freiburg im Breisgau', state: 'baden-wuerttemberg', lat: 47.999, lng: 7.842 },
  { slug: 'heidelberg', name: 'Heidelberg', state: 'baden-wuerttemberg', lat: 49.398, lng: 8.672 },
  { slug: 'muenster', name: 'Münster', state: 'nordrhein-westfalen', lat: 51.961, lng: 7.626 },
  { slug: 'aachen', name: 'Aachen', state: 'nordrhein-westfalen', lat: 50.776, lng: 6.084 },
  { slug: 'kiel', name: 'Kiel', state: 'schleswig-holstein', lat: 54.323, lng: 10.123 },
  { slug: 'rostock', name: 'Rostock', state: 'mecklenburg-vorpommern', lat: 54.092, lng: 12.099 },
  { slug: 'mainz', name: 'Mainz', state: 'rheinland-pfalz', lat: 49.993, lng: 8.247 },
  { slug: 'wiesbaden', name: 'Wiesbaden', state: 'hessen', lat: 50.078, lng: 8.24 },
  { slug: 'augsburg', name: 'Augsburg', state: 'bayern', lat: 48.371, lng: 10.898 },
  { slug: 'regensburg', name: 'Regensburg', state: 'bayern', lat: 49.013, lng: 12.101 },
  { slug: 'erfurt', name: 'Erfurt', state: 'thueringen', lat: 50.978, lng: 11.029 },
  { slug: 'jena', name: 'Jena', state: 'thueringen', lat: 50.927, lng: 11.589 },
  { slug: 'magdeburg', name: 'Magdeburg', state: 'sachsen-anhalt', lat: 52.12, lng: 11.627 },
  { slug: 'halle-saale', name: 'Halle (Saale)', state: 'sachsen-anhalt', lat: 51.482, lng: 11.97 },
  { slug: 'saarbruecken', name: 'Saarbrücken', state: 'saarland', lat: 49.234, lng: 6.996 },
  { slug: 'goettingen', name: 'Göttingen', state: 'niedersachsen', lat: 51.541, lng: 9.916 },
];

export const CITY_BY_SLUG = Object.fromEntries(CITIES.map((c) => [c.slug, c]));

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
