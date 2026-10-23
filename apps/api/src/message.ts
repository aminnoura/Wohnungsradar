import Anthropic from '@anthropic-ai/sdk';
import { isInformal, templateMessage, type Listing, type MessageLang, type TenantProfile } from '@wr/shared';

const MODEL = 'claude-opus-5-5';

// Constant across requests so it can be cached; everything listing- or applicant-specific goes in the user turn.
const SYSTEM = `You write the first contact message a flat seeker sends to a landlord, property manager or flatshare through a German rental portal's contact form.

Goal: get invited to a viewing. Berlin landlords receive hundreds of messages per flat and skim them in seconds, so the message must be short, concrete and trustworthy.

Rules:
- Write in the requested language. In German use "Sie" unless told the listing is a WG room, then use "du"/"ihr".
- 90 to 150 words. Plain text, no subject line, no emojis, no markdown, no placeholders like [Name].
- Open with one sentence that shows the listing was actually read: refer to one or two specific details from it (area, a feature, the move-in date, the building) - never generic praise.
- Then the applicant facts a landlord checks first, using only what the profile provides: who moves in, occupation, net income (and that it comfortably covers the rent when it is at least about 3x the warm rent), move-in date, WBS if the listing requires one, non-smoker/pets, SCHUFA.
- For a swap (Tauschwohnung) listing, describe the applicant's own flat offered in exchange.
- If the listing requires a WBS and the profile has none, do not claim one; keep the message honest.
- Never invent facts about the applicant. Omit anything the profile does not contain.
- Close by offering to send documents and asking for a viewing, then sign with the applicant's name (and phone if given).

Return only the message text.`;

let client: Anthropic | null = null;
const llmEnabled = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

// Avoid paying twice for the same listing + profile + language unless the user asks for a new version.
const cache = new Map<string, string>();

function listingBrief(l: Listing, fullText: string | null): string {
  const facts = {
    title: l.title,
    portal: l.source,
    offerer: l.offerer,
    address: [l.street, l.plz, l.ortsteil ?? l.bezirk, l.city].filter(Boolean).join(', '),
    coldRent: l.coldRent,
    warmRent: l.warmRent,
    sizeM2: l.sizeM2,
    rooms: l.rooms,
    floor: l.floor,
    availableFrom: l.availableFrom,
    wbsRequired: l.wbsRequired,
    wbsLevel: l.wbsLevel,
    isSwap: l.isSwap,
    isWgRoom: l.isWgRoom,
    furnished: l.furnished,
    limitedTerm: l.limitedTerm,
    features: (['balcony', 'kitchen', 'elevator', 'garden', 'cellar', 'barrierFree', 'petsAllowed'] as const).filter((k) => l[k]),
  };
  const compact = Object.fromEntries(Object.entries(facts).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)));
  return `Listing facts: ${JSON.stringify(compact)}\n\nListing text (scraped, may be truncated):\n${(fullText ?? l.excerpt ?? '').slice(0, 3000)}`;
}

export interface GeneratedMessage {
  text: string;
  source: 'claude' | 'template';
}

export async function generateMessage(
  l: Listing,
  fullText: string | null,
  profile: TenantProfile,
  lang: MessageLang,
  fresh: boolean,
  log: { warn: (o: object, msg: string) => void },
): Promise<GeneratedMessage> {
  if (!llmEnabled()) return { text: templateMessage(l, profile, lang), source: 'template' };

  const key = JSON.stringify([l.id, profile, lang]);
  if (!fresh && cache.has(key)) return { text: cache.get(key)!, source: 'claude' };

  client ??= new Anthropic();
  const user = [
    `Language: ${lang === 'de' ? 'German' : 'English'}${isInformal(l) ? ' (WG room: informal)' : ''}`,
    listingBrief(l, fullText),
    `Applicant profile: ${JSON.stringify(profile)}`,
    fresh ? 'Write a different version than before (other opening, other details).' : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Short, formulaic writing: low effort keeps latency and cost down.
      output_config: { effort: 'low' },
      // If the request is ever declined by a safety classifier, the API retries it on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    });
    if (response.stop_reason === 'refusal') throw new Error('refused');
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (!text) throw new Error('empty response');
    cache.set(key, text);
    return { text, source: 'claude' };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) log.warn({}, 'ANTHROPIC_API_KEY rejected, using template');
    else if (e instanceof Anthropic.RateLimitError) log.warn({}, 'Claude rate limited, using template');
    else if (e instanceof Anthropic.APIError) log.warn({ status: e.status }, `Claude API error: ${e.message}`);
    else log.warn({ err: (e as Error).message }, 'message generation failed, using template');
    return { text: templateMessage(l, profile, lang), source: 'template' };
  }
}
