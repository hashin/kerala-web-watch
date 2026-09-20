import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../src/registry.js';
import { validateRegistry } from '../src/validate.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => join(here, 'fixtures', 'registry', name);

describe('loadRegistry', () => {
  it('loads a valid registry into typed objects and derived maps', () => {
    const registry = loadRegistry(fixture('valid'));

    expect(registry.sites).toHaveLength(2);
    expect(registry.byId.get('finance')?.name).toBe('Finance Department');
    expect(registry.byDepartment.get('fin')).toHaveLength(2);
    expect(registry.byDistrict.get('thiruvananthapuram')).toHaveLength(2);
    expect(registry.byMinistry.get('cm')).toHaveLength(2);
  });

  it('normalises urls when loading', () => {
    const registry = loadRegistry(fixture('duplicate-url'));
    expect(registry.byId.get('finance')?.url).toBe('https://kerala.gov.in');
  });
});

describe('validateRegistry: valid registry', () => {
  it('reports no failures for the valid fixture', () => {
    expect(validateRegistry(fixture('valid'))).toEqual([]);
  });
});

describe('validateRegistry: rule violations', () => {
  it('rejects two sites sharing the same id', () => {
    const failures = validateRegistry(fixture('duplicate-id'));
    expect(failures.some((f) => f.rule === 'unique-id')).toBe(true);
  });

  it('rejects two sites whose urls normalise to the same value', () => {
    const failures = validateRegistry(fixture('duplicate-url'));
    expect(failures.some((f) => f.rule === 'unique-url')).toBe(true);
  });

  it('ADR-022: allows a shared url when both sites mutually document it in notes', () => {
    const failures = validateRegistry(fixture('shared-url-documented'));
    expect(failures.some((f) => f.rule === 'unique-url')).toBe(false);
  });

  it('ADR-022: still rejects a shared url when only one side documents it', () => {
    const failures = validateRegistry(fixture('shared-url-one-sided'));
    expect(failures.some((f) => f.rule === 'unique-url')).toBe(true);
  });

  it('ADR-022: one-sided rejection holds regardless of which entry is listed first', () => {
    const failures = validateRegistry(fixture('shared-url-one-sided-reversed'));
    expect(failures.some((f) => f.rule === 'unique-url')).toBe(true);
  });

  it('ADR-022: a coincidental id substring in unrelated notes text does not count as documented', () => {
    const failures = validateRegistry(fixture('shared-url-substring-trap'));
    expect(failures.some((f) => f.rule === 'unique-url')).toBe(true);
  });

  it('rejects a site referencing a department that does not exist', () => {
    const failures = validateRegistry(fixture('bad-department-ref'));
    expect(failures).toEqual([
      expect.objectContaining({ rule: 'department-ref', id: 'finance' }),
    ]);
  });

  it('rejects a site referencing a district that does not exist', () => {
    const failures = validateRegistry(fixture('bad-district-ref'));
    expect(failures).toEqual([
      expect.objectContaining({ rule: 'district-ref', id: 'finance' }),
    ]);
  });

  it('rejects a site referencing a place that does not exist', () => {
    const failures = validateRegistry(fixture('bad-place-ref'));
    expect(failures).toEqual([
      expect.objectContaining({ rule: 'place-ref', id: 'finance' }),
    ]);
  });

  it('rejects a site whose place belongs to a different district than the site declares', () => {
    const failures = validateRegistry(fixture('place-district-mismatch'));
    expect(failures).toEqual([
      expect.objectContaining({ rule: 'place-district', id: 'finance' }),
    ]);
  });

  it('rejects lsg_type set on a site whose tier is not lsg', () => {
    const failures = validateRegistry(fixture('lsg-type-invalid'));
    expect(failures).toEqual([
      expect.objectContaining({ rule: 'lsg-type', id: 'kerala-gov' }),
    ]);
  });

  it('rejects a site whose tier is lsg but has no lsg_type', () => {
    const failures = validateRegistry(fixture('lsg-type-missing'));
    expect(failures).toEqual([
      expect.objectContaining({ rule: 'lsg-type', id: 'kerala-gov' }),
    ]);
  });

  it('rejects an org_parent that is not a known site id', () => {
    const failures = validateRegistry(fixture('bad-org-parent-ref'));
    expect(failures).toEqual([
      expect.objectContaining({ rule: 'org-parent-ref', id: 'finance' }),
    ]);
  });

  it('rejects a lifecycle merged-into pointing at an unknown site id', () => {
    const failures = validateRegistry(fixture('bad-merged-into-ref'));
    expect(failures).toEqual([
      expect.objectContaining({ rule: 'merged-into-ref', id: 'kerala-gov' }),
    ]);
  });

  it('rejects a kind that is not in kinds.yaml', () => {
    const failures = validateRegistry(fixture('bad-kind-ref'));
    expect(failures).toEqual([
      expect.objectContaining({ rule: 'kind-ref', id: 'kerala-gov' }),
    ]);
  });

  it('rejects a site alias that duplicates another site\'s url', () => {
    const failures = validateRegistry(fixture('duplicate-url-alias'));
    expect(failures).toEqual([
      expect.objectContaining({ rule: 'unique-url', id: 'finance' }),
    ]);
  });

  it('rejects an id that does not match the schema pattern', () => {
    const failures = validateRegistry(fixture('bad-id-pattern'));
    expect(failures.some((f) => f.rule === 'schema' && f.message.includes('/id'))).toBe(true);
  });
});
