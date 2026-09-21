import { request } from 'undici';

export interface SafeBrowsingOptions {
  /** Defaults to `process.env.SAFE_BROWSING_KEY`. */
  apiKey?: string;
  timeoutMs?: number;
  /** Overrides the API endpoint, e.g. for pointing at a local fixture server in tests. */
  endpoint?: string;
}

const DEFAULT_ENDPOINT = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

/**
 * Checks a URL against Google Safe Browsing's Lookup API v4. Returns `null` ("not checked", not
 * "clean") whenever no API key is configured -- this is explicitly optional per DESIGN §5.3 and
 * CLAUDE.md's "things only the human can do" (the human supplies `SAFE_BROWSING_KEY`) -- or when
 * the lookup itself fails, since a transient network problem must not be reported as a clean bill
 * of health.
 */
export async function isFlaggedBySafeBrowsing(url: string, opts: SafeBrowsingOptions = {}): Promise<boolean | null> {
  const apiKey = opts.apiKey ?? process.env.SAFE_BROWSING_KEY;
  if (!apiKey) return null;
  const body = {
    client: { clientId: 'kerala-web-watch', clientVersion: '1.0' },
    threatInfo: {
      threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: [{ url }],
    },
  };
  try {
    const response = await request(`${opts.endpoint ?? DEFAULT_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      headersTimeout: opts.timeoutMs ?? 20_000,
      bodyTimeout: opts.timeoutMs ?? 20_000,
    });
    if (response.statusCode !== 200) {
      await response.body.dump();
      return null;
    }
    const parsed = (await response.body.json()) as { matches?: unknown[] };
    return (parsed.matches?.length ?? 0) > 0;
  } catch {
    return null;
  }
}
