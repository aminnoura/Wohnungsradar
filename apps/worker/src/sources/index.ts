import { SOURCES } from '@wr/shared';
import { degewo, gesobau, gewobag, howoge, inberlinwohnen, stadtundland, wbm } from './berlinHousing';
import { berlinovo, covivio, deutschewohnen, heimstaden, immowelt, meinestadt, tauschwohnung, vonovia, web } from './discovery';
import { immoscout24 } from './immoscout24';
import { kleinanzeigen } from './kleinanzeigen';
import { adler, housinganywhere, ohnemakler, wunderflats } from './portals';
import type { SourceAdapter } from './types';
import { wggesucht } from './wggesucht';

export const ADAPTERS: SourceAdapter[] = [
  immoscout24, kleinanzeigen, wggesucht, ohnemakler, immowelt, meinestadt,
  inberlinwohnen, degewo, gewobag, howoge, wbm, gesobau, stadtundland, berlinovo,
  adler, vonovia, deutschewohnen, heimstaden, covivio,
  tauschwohnung, wunderflats, housinganywhere, web,
];

// Every source declared in @wr/shared must have an adapter and vice versa.
const missing = SOURCES.filter((s) => !ADAPTERS.some((a) => a.id === s.id)).map((s) => s.id);
if (missing.length) throw new Error(`No adapter for sources: ${missing.join(', ')}`);

export function enabledAdapters(): SourceAdapter[] {
  const only = (process.env.SOURCES_ENABLED ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return only.length ? ADAPTERS.filter((a) => only.includes(a.id)) : ADAPTERS;
}
