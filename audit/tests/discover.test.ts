import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { load as loadYaml } from 'js-yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  discoverCandidates,
  filterCandidateHosts,
  isIgnoredHost,
  looksLikeKeralaGovHost,
  newCandidateHosts,
  registeredHosts,
  renderCandidatesYaml,
  toDiscoveryTable,
  type DiscoveredCandidate,
} from '../src/discover.js';
import type { OutlinksData } from '../src/outlinks.js';
import type { IgnoreEntry, Registry, Site } from '../src/types.js';

function site(overrides: Partial<Site>): Site {
  return {
    id: 'x',
    name: 'X Directorate',
    url: 'https://x.kerala.gov.in',
    aliases: [],
    tier: 'directorate',
    kind: 'directorate',
    department: 'gad',
    org_parent: null,
    scope: 'state',
    district: null,
    place: null,
    lsg_type: null,
    platform: null,
    priority: 2,
    tags: [],
    source: 'test',
    added: '2026-09-21',
    lifecycle: 'active',
    notes: '',
    ...overrides,
  };
}

function registryOf(sites: Site[]): Registry {
  return {
    sites,
    departments: [],
    districts: [],
    places: [],
    kinds: [],
    ministers: [],
    ignore: [],
    byId: new Map(sites.map((s) => [s.id, s])),
    byDepartment: new Map(),
    byDistrict: new Map(),
    byMinistry: new Map(),
  };
}

const outlink = (over: Partial<OutlinksData[string]> = {}): OutlinksData[string] => ({ count: 3, from: ['x'], texts: ['Some Link'], ...over });

describe('looksLikeKeralaGovHost', () => {
  it('matches a .kerala.gov.in host', () => {
    expect(looksLikeKeralaGovHost('new.kerala.gov.in', [])).toBe(true);
  });

  it('matches a .nic.in host even with no kerala-mentioning text', () => {
    expect(looksLikeKeralaGovHost('someboard.nic.in', ['Click here'])).toBe(true);
  });

  it('matches a non-gov host whose anchor text names Kerala', () => {
    expect(looksLikeKeralaGovHost('example.org', ['Government of Kerala portal'])).toBe(true);
  });

  it('rejects an unrelated host with no gov domain and no kerala-mentioning text', () => {
    expect(looksLikeKeralaGovHost('facebook.com', ['Follow us'])).toBe(false);
  });
});

describe('filterCandidateHosts', () => {
  it('keeps only gov-looking hosts, sorted', () => {
    const outlinks: OutlinksData = {
      'b.kerala.gov.in': outlink(),
      'facebook.com': outlink({ texts: ['Follow us'] }),
      'a.nic.in': outlink(),
    };
    expect(filterCandidateHosts(outlinks)).toEqual(['a.nic.in', 'b.kerala.gov.in']);
  });
});

describe('registeredHosts', () => {
  it('includes both a site url and its aliases', () => {
    const registry = registryOf([site({ id: 'x', url: 'https://x.kerala.gov.in', aliases: ['https://x-old.kerala.gov.in'] })]);
    const hosts = registeredHosts(registry);
    expect(hosts.has('x.kerala.gov.in')).toBe(true);
    expect(hosts.has('x-old.kerala.gov.in')).toBe(true);
  });
});

describe('isIgnoredHost', () => {
  const ignore: IgnoreEntry[] = [{ pattern: 'aai.aero', reason: 'central' }];

  it('matches the pattern host exactly', () => {
    expect(isIgnoredHost('aai.aero', ignore)).toBe(true);
  });

  it('matches a subdomain of the pattern', () => {
    expect(isIgnoredHost('cochin.aai.aero', ignore)).toBe(true);
  });

  it('does not match an unrelated host', () => {
    expect(isIgnoredHost('kerala.gov.in', ignore)).toBe(false);
  });
});

describe('newCandidateHosts', () => {
  it('drops a host already registered, a host in ignore.yaml, and keeps a genuinely new one', () => {
    const registry = registryOf([site({ id: 'x', url: 'https://x.kerala.gov.in' })]);
    const outlinks: OutlinksData = {
      'x.kerala.gov.in': outlink(),
      'ignored.gov.in': outlink(),
      'new.kerala.gov.in': outlink(),
    };
    const ignore: IgnoreEntry[] = [{ pattern: 'ignored.gov.in', reason: 'central' }];
    expect(newCandidateHosts(outlinks, registry, ignore)).toEqual(['new.kerala.gov.in']);
  });
});

describe('discoverCandidates against a local HTTP server', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html><head><title>New Board</title></head><body>hi</body></html>');
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('keeps a reachable host with its fetched title, seen_from and link_count carried through', async () => {
    const registry = registryOf([site({ id: 'x', url: 'https://x.kerala.gov.in' })]);
    const host = `127.0.0.1:${port}`;
    const outlinks: OutlinksData = { [host]: outlink({ from: ['x'], count: 7 }) };

    const candidates = await discoverCandidates([host], outlinks, registry, { scheme: 'http' });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].name).toBe('New Board');
    expect(candidates[0].seen_from).toEqual(['x']);
    expect(candidates[0].link_count).toBe(7);
    expect(candidates[0].source_page).toBe('https://x.kerala.gov.in');
  });

  it('falls back to the host itself as the name when the fetched page has no title', async () => {
    const noTitleServer = createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><body>hi, no title tag here</body></html>');
    });
    await new Promise<void>((resolve) => noTitleServer.listen(0, '127.0.0.1', resolve));
    const noTitlePort = (noTitleServer.address() as AddressInfo).port;

    try {
      const registry = registryOf([]);
      const host = `127.0.0.1:${noTitlePort}`;
      const outlinks: OutlinksData = { [host]: outlink() };

      const candidates = await discoverCandidates([host], outlinks, registry, { scheme: 'http' });

      expect(candidates).toHaveLength(1);
      expect(candidates[0].name).toBe(host);
    } finally {
      await new Promise<void>((resolve) => noTitleServer.close(() => resolve()));
    }
  });

  it('skips a host that does not resolve at all', async () => {
    const registry = registryOf([]);
    const outlinks: OutlinksData = { 'this-host-does-not-exist.invalid': outlink() };
    const candidates = await discoverCandidates(['this-host-does-not-exist.invalid'], outlinks, registry);
    expect(candidates).toEqual([]);
  });

  it('waits between requests so a batch of hosts is checked no faster than 1/second', async () => {
    const registry = registryOf([]);
    const host = `127.0.0.1:${port}`;
    const outlinks: OutlinksData = { [host]: outlink(), 'this-host-does-not-exist.invalid': outlink() };
    const waits: number[] = [];

    await discoverCandidates([host, 'this-host-does-not-exist.invalid'], outlinks, registry, {
      scheme: 'http',
      sleep: async (ms) => {
        waits.push(ms);
      },
    });

    expect(waits).toEqual([1000]);
  });
});

describe('toDiscoveryTable', () => {
  it('reports no candidates plainly', () => {
    expect(toDiscoveryTable([])).toBe('_No new candidates this week._');
  });

  it('renders one row per candidate with host, title, seen-from and link count', () => {
    const candidate: DiscoveredCandidate = {
      url: 'https://new.kerala.gov.in',
      name: 'New Board',
      source: 'discover',
      source_page: 'https://x.kerala.gov.in',
      hints: {},
      fetched_at: '2026-09-24T00:00:00.000Z',
      seen_from: ['x', 'y'],
      link_count: 4,
    };
    const table = toDiscoveryTable([candidate]);
    expect(table).toContain('| new.kerala.gov.in | New Board | x, y | 4 |');
  });
});

describe('renderCandidatesYaml', () => {
  it('round-trips a candidate list through YAML unchanged', () => {
    const candidate: DiscoveredCandidate = {
      url: 'https://new.kerala.gov.in',
      name: 'New Board',
      source: 'discover',
      source_page: 'https://x.kerala.gov.in',
      hints: {},
      fetched_at: '2026-09-24T00:00:00.000Z',
      seen_from: ['x'],
      link_count: 4,
    };
    const parsed = loadYaml(renderCandidatesYaml([candidate]));
    expect(parsed).toEqual([candidate]);
  });
});
