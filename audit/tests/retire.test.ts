import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetRetireCache, scanForVulnerableLibraries } from '../src/net/retire.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const JSREPO = join(FIXTURES, 'retire', 'jsrepo.json');
const jqueryContent = readFileSync(join(FIXTURES, 'scripts', 'jquery-1.8.3.min.js'), 'utf8');
const cleanContent = readFileSync(join(FIXTURES, 'scripts', 'clean-app.js'), 'utf8');

describe('scanForVulnerableLibraries against the real retire.js CLI', () => {
  beforeEach(() => resetRetireCache());

  it('reports at least one CVE for the vendored old jQuery fixture, using a local fixture jsrepo so the scan stays offline', async () => {
    const url = 'https://example.gov.in/vendor/jquery-1.8.3.min.js';
    const result = await scanForVulnerableLibraries([{ url, content: jqueryContent }], { jsrepo: JSREPO });
    const found = result.get(url)!;
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found[0].library).toBe('jquery');
    expect(found[0].cve).toContain('CVE-2012-6708');
  }, 30_000);

  it('reports nothing for an ordinary script with no known-vulnerable signature', async () => {
    const url = 'https://example.gov.in/app.js';
    const result = await scanForVulnerableLibraries([{ url, content: cleanContent }], { jsrepo: JSREPO });
    expect(result.get(url)).toEqual([]);
  }, 30_000);

  it('caches by content hash: a second scan of the same content does not need to run retire again', async () => {
    const first = await scanForVulnerableLibraries([{ url: 'https://a.example/jquery.js', content: jqueryContent }], { jsrepo: JSREPO });
    // A different URL, identical content -- the cache is keyed by content hash, not url, so this
    // must resolve from cache with the same result rather than re-scanning.
    const second = await scanForVulnerableLibraries([{ url: 'https://b.example/jquery.js', content: jqueryContent }], { jsrepo: JSREPO });
    expect(second.get('https://b.example/jquery.js')).toEqual(first.get('https://a.example/jquery.js'));
  }, 30_000);

  it('really does skip re-invoking retire on a cache hit: a broken jsrepo path on the second call does not change the result', async () => {
    // If the second call actually ran retire again, a nonexistent --jsrepo would make it fail and
    // return no findings -- proving this returns the *first* call's real finding demonstrates the
    // scan was never re-run, not just that two independent scans happened to agree.
    const first = await scanForVulnerableLibraries([{ url: 'https://c.example/jquery.js', content: jqueryContent }], { jsrepo: JSREPO });
    const second = await scanForVulnerableLibraries(
      [{ url: 'https://d.example/jquery.js', content: jqueryContent }],
      { jsrepo: join(FIXTURES, 'retire', 'does-not-exist.json') },
    );
    expect(second.get('https://d.example/jquery.js')).toEqual(first.get('https://c.example/jquery.js'));
    expect(second.get('https://d.example/jquery.js')!.length).toBeGreaterThanOrEqual(1);
  }, 30_000);
});
