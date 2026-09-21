import { httpGet } from './http.js';

/** Domain-expiry lookups are cached per audit run (a module-level Map, cleared with
 * `resetRdapCache` between runs and tests) since a run touches every site every day and a
 * repeated lookup of the same registrable domain would be impolite for no new information. */
const cache = new Map<string, number | null>();

export function resetRdapCache(): void {
  cache.clear();
}

export interface RdapOptions {
  timeoutMs?: number;
  now?: () => Date;
  /** Overrides the RDAP host, e.g. for pointing at a local fixture server in tests. Defaults to
   * the real rdap.org proxy, which needs no API key (CLAUDE.md's politeness rules). */
  baseUrl?: string;
}

const DEFAULT_BASE_URL = 'https://rdap.org';

/**
 * Looks up a registrable domain's expiry via the free rdap.org proxy and returns days remaining.
 * Returns `null` when RDAP has no expiration event for the domain or the lookup fails -- callers
 * must not treat `null` as "expiring soon", only as "unknown".
 */
export async function domainExpiryDays(domain: string, opts: RdapOptions = {}): Promise<number | null> {
  if (cache.has(domain)) return cache.get(domain)!;
  const days = await lookupExpiry(domain, opts);
  cache.set(domain, days);
  return days;
}

async function lookupExpiry(domain: string, opts: RdapOptions): Promise<number | null> {
  const result = await httpGet(`${opts.baseUrl ?? DEFAULT_BASE_URL}/domain/${domain}`, { timeoutMs: opts.timeoutMs ?? 20_000 });
  if (result.errorKind || result.status !== 200 || !result.body) return null;
  try {
    const parsed = JSON.parse(result.body) as { events?: { eventAction?: string; eventDate?: string }[] };
    const expiryEvent = parsed.events?.find((event) => event.eventAction === 'expiration');
    if (!expiryEvent?.eventDate) return null;
    const now = opts.now ? opts.now() : new Date();
    return Math.round((new Date(expiryEvent.eventDate).getTime() - now.getTime()) / 86_400_000);
  } catch {
    return null;
  }
}
