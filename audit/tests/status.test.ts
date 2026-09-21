import { describe, expect, it } from 'vitest';
import { deriveStatus, explainLightStatus, isBrokenClass } from '../src/status.js';
import type { LightResult } from '../src/light.js';

function light(overrides: Partial<LightResult> = {}): LightResult {
  return {
    at: '2026-09-21T00:00:00.000Z',
    status_class: 'ok',
    dns: true,
    status: 200,
    final_url: 'https://example.kerala.gov.in',
    redirects: [],
    ttfb_ms: 100,
    title: 'Example',
    byte_size: 1000,
    tls: { valid: true, protocol: 'TLSv1.3', expires: null, days_left: null, issuer: null },
    headers: { hsts: true, csp: false, xfo: true, xcto: true, referrer: false, server: null },
    content_hash: 'abc',
    http_redirects_to_https: true,
    geo_block_suspect: false,
    domain: 'kerala.gov.in',
    final_domain: 'kerala.gov.in',
    ...overrides,
  };
}

describe('deriveStatus', () => {
  it('marks a first-time healthy check as unaudited (no deep audit has run yet)', () => {
    const outcome = deriveStatus({ previousStatus: 'unaudited', previousLight: null, newLight: light(), hasDeepAudit: false });
    expect(outcome).toEqual({ status: 'unaudited', lightSuspect: false });
  });

  it('keeps a deep-audit-derived status when the light check is healthy', () => {
    const outcome = deriveStatus({ previousStatus: 'needs-work', previousLight: null, newLight: light(), hasDeepAudit: true });
    expect(outcome.status).toBe('needs-work');
  });

  it('flags the first failure as suspect without changing status', () => {
    const failing = light({ status_class: 'connect_fail', status: null, tls: null });
    const outcome = deriveStatus({ previousStatus: 'unaudited', previousLight: null, newLight: failing, hasDeepAudit: false });
    expect(outcome).toEqual({ status: 'unaudited', lightSuspect: true });
  });

  it('only marks down after two consecutive failures', () => {
    const failing = light({ status_class: 'connect_fail', status: null, tls: null });
    const outcome = deriveStatus({ previousStatus: 'unaudited', previousLight: failing, newLight: failing, hasDeepAudit: false });
    expect(outcome).toEqual({ status: 'down', lightSuspect: false });
  });

  it('recovers from down back to unaudited once a light check succeeds', () => {
    const failing = light({ status_class: 'connect_fail', status: null, tls: null });
    const outcome = deriveStatus({ previousStatus: 'down', previousLight: failing, newLight: light(), hasDeepAudit: false });
    expect(outcome).toEqual({ status: 'unaudited', lightSuspect: false });
  });

  it('marks broken for an invalid certificate regardless of the failure streak', () => {
    const invalidCert = light({ tls: { valid: false, protocol: 'TLSv1.2', expires: '2020-01-01', days_left: -2000, issuer: 'Test CA' } });
    const outcome = deriveStatus({ previousStatus: 'unaudited', previousLight: null, newLight: invalidCert, hasDeepAudit: false });
    expect(outcome).toEqual({ status: 'broken', lightSuspect: false });
  });

  it('marks unverifiable for a geo-block-suspect 403, never down', () => {
    const geoBlocked = light({ status_class: 'http_403', status: 403, geo_block_suspect: true });
    const previouslyGeoBlocked = light({ status_class: 'http_403', status: 403, geo_block_suspect: true });
    const outcome = deriveStatus({ previousStatus: 'unverifiable', previousLight: previouslyGeoBlocked, newLight: geoBlocked, hasDeepAudit: false });
    expect(outcome.status).toBe('unverifiable');
  });
});

describe('explainLightStatus', () => {
  it('names avail.dns for a DNS failure', () => {
    expect(explainLightStatus(light({ status_class: 'dns_fail', dns: false, status: null, tls: null }))).toBe('avail.dns');
  });

  it('names avail.connect for a refused connection', () => {
    expect(explainLightStatus(light({ status_class: 'connect_fail', status: null, tls: null }))).toBe('avail.connect');
  });

  it('names avail.connect for a timeout, same as a refused connection', () => {
    expect(explainLightStatus(light({ status_class: 'timeout', status: null, tls: null }))).toBe('avail.connect');
  });

  it('names avail.status for a non-2xx final response', () => {
    expect(explainLightStatus(light({ status_class: 'http_503', status: 503 }))).toBe('avail.status');
  });

  it('names sec.cert_valid for an invalid certificate even when the request itself succeeded', () => {
    const invalidCert = light({ tls: { valid: false, protocol: 'TLSv1.2', expires: '2020-01-01', days_left: -2000, issuer: 'Test CA' } });
    expect(explainLightStatus(invalidCert)).toBe('sec.cert_valid');
  });

  it('names avail.geo_blocked ahead of any other failure, matching deriveStatus\'s own precedence', () => {
    const geoBlockedWithBadCert = light({
      status_class: 'http_403',
      status: 403,
      geo_block_suspect: true,
      tls: { valid: false, protocol: 'TLSv1.2', expires: '2020-01-01', days_left: -2000, issuer: 'Test CA' },
    });
    expect(explainLightStatus(geoBlockedWithBadCert)).toBe('avail.geo_blocked');
  });

  it('returns null for a healthy light check', () => {
    expect(explainLightStatus(light())).toBeNull();
  });
});

describe('isBrokenClass', () => {
  it('counts down, hijacked and broken as the headline "broken" number', () => {
    expect(isBrokenClass('down')).toBe(true);
    expect(isBrokenClass('hijacked')).toBe(true);
    expect(isBrokenClass('broken')).toBe(true);
  });

  it('does not count unverifiable, unaudited or a scored status as broken', () => {
    expect(isBrokenClass('unverifiable')).toBe(false);
    expect(isBrokenClass('unaudited')).toBe(false);
    expect(isBrokenClass('healthy')).toBe(false);
    expect(isBrokenClass('needs-work')).toBe(false);
    expect(isBrokenClass('poor')).toBe(false);
  });
});
