import { describe, expect, it } from 'vitest';
import { normalizeUrl } from '../src/url.js';

describe('normalizeUrl', () => {
  it('lowercases the host', () => {
    expect(normalizeUrl('https://Kerala.GOV.in/page')).toBe('https://kerala.gov.in/page');
  });

  it('strips a trailing "/" root path but keeps deeper paths', () => {
    expect(normalizeUrl('https://kerala.gov.in/')).toBe('https://kerala.gov.in');
    expect(normalizeUrl('https://kerala.gov.in/page/')).toBe('https://kerala.gov.in/page/');
  });

  it('drops the default port for the scheme', () => {
    expect(normalizeUrl('https://kerala.gov.in:443/')).toBe('https://kerala.gov.in');
    expect(normalizeUrl('http://kerala.gov.in:80/')).toBe('http://kerala.gov.in');
  });

  it('keeps a non-default port', () => {
    expect(normalizeUrl('https://kerala.gov.in:8443/')).toBe('https://kerala.gov.in:8443');
  });

  it('treats http and https as different urls', () => {
    expect(normalizeUrl('http://kerala.gov.in')).not.toBe(normalizeUrl('https://kerala.gov.in'));
  });
});
