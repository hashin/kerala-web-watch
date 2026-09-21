import { lookup } from 'node:dns/promises';

/**
 * Resolves ok if either address family answers -- an AAAA-only or A-only host is still a real,
 * reachable site. Both lookups run even after one succeeds so callers get an accurate `family`
 * for IPv4-only vs IPv6-only vs dual-stack, which matters for later runner-vantage debugging.
 */
export async function resolveDns(hostname: string): Promise<{ ok: boolean; family4: boolean; family6: boolean }> {
  const [family4, family6] = await Promise.all([resolves(hostname, 4), resolves(hostname, 6)]);
  return { ok: family4 || family6, family4, family6 };
}

async function resolves(hostname: string, family: 4 | 6): Promise<boolean> {
  try {
    await lookup(hostname, { family });
    return true;
  } catch {
    return false;
  }
}
