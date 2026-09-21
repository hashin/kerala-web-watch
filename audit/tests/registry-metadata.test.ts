import { describe, expect, it } from 'vitest';
import { CHECKS } from '../src/checks/registry.js';

const VALID_CATEGORIES = new Set(['availability', 'security', 'accessibility', 'content', 'gigw', 'performance', 'identity']);
const VALID_SEVERITIES = new Set(['C', 'H', 'M', 'L', 'I']);
const VALID_STATUS_SETTINGS = new Set(['down', 'hijacked', 'broken', 'unverifiable']);

describe('CHECKS metadata', () => {
  const entries = Object.entries(CHECKS);

  it('has roughly the ~90 checks DESIGN §5.3 catalogues', () => {
    expect(entries.length).toBeGreaterThan(70);
    expect(entries.length).toBeLessThan(100);
  });

  it('every id is unique (an object literal already guarantees this, but pins the count)', () => {
    expect(new Set(Object.keys(CHECKS)).size).toBe(entries.length);
  });

  it.each(entries)('%s has a valid category and severity', (id, meta) => {
    expect(VALID_CATEGORIES.has(meta.category), `${id} has invalid category "${meta.category}"`).toBe(true);
    expect(VALID_SEVERITIES.has(meta.severity), `${id} has invalid severity "${meta.severity}"`).toBe(true);
  });

  it.each(entries)('%s has non-empty English title, citizen and fix text', (id, meta) => {
    expect(meta.title.en.length, `${id} has empty title.en`).toBeGreaterThan(0);
    expect(meta.citizen.en.length, `${id} has empty citizen.en`).toBeGreaterThan(0);
    expect(meta.fix.en.length, `${id} has empty fix.en`).toBeGreaterThan(0);
  });

  it.each(entries)('%s has an ml field present (may be empty until WP5.3)', (id, meta) => {
    expect(typeof meta.title.ml, `${id} title.ml`).toBe('string');
    expect(typeof meta.citizen.ml, `${id} citizen.ml`).toBe('string');
    expect(typeof meta.fix.ml, `${id} fix.ml`).toBe('string');
  });

  it.each(entries)('%s has a defined (possibly empty) ref', (id, meta) => {
    expect(typeof meta.ref, `${id} ref`).toBe('string');
  });

  it.each(entries.filter(([, meta]) => meta.statusSetting !== undefined))(
    '%s names a valid statusSetting',
    (id, meta) => {
      expect(VALID_STATUS_SETTINGS.has(meta.statusSetting!), `${id} has invalid statusSetting "${meta.statusSetting}"`).toBe(true);
    },
  );

  it('every availability-category check is either status-setting or one of the two known non-★ exceptions', () => {
    // avail.ttfb and avail.flapping are the only avail.* checks DESIGN §5.3 doesn't mark ★ --
    // everything else in the availability category must set a status, since availability checks
    // that neither set status nor score anything would be checks that can never do anything.
    const nonStarExceptions = new Set(['avail.ttfb', 'avail.flapping']);
    for (const [id, meta] of entries) {
      if (meta.category !== 'availability') continue;
      const isException = nonStarExceptions.has(id);
      expect(meta.statusSetting !== undefined || isException, `${id} is availability-category but neither ★ nor a known exception`).toBe(true);
    }
  });
});
