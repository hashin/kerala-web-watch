import type { LightResult } from './light.js';

export type ResultStatus = 'unaudited' | 'down' | 'hijacked' | 'broken' | 'unverifiable' | 'healthy' | 'needs-work' | 'poor';

/** The headline "broken" number per ADR-005 is down ∪ hijacked ∪ broken -- everything else
 * (including unverifiable and unaudited) counts as reachable for uptime-history purposes. */
export function isBrokenClass(status: ResultStatus): boolean {
  return status === 'down' || status === 'hijacked' || status === 'broken';
}

/** Everything DESIGN §5.3's avail.status/avail.dns/avail.connect checks would fail: not a clean
 * 2xx final response, within the ≤5-hop redirect cap `light.ts` already enforces. */
function isLightFailure(light: LightResult): boolean {
  return light.status_class !== 'ok';
}

export interface StatusInput {
  previousStatus: ResultStatus;
  previousLight: LightResult | null;
  newLight: LightResult;
  /** Whether a Phase-3 deep audit has ever scored this site -- WP2.2 never sets this true itself,
   * but a light check that comes back healthy must not erase a deep-audit-derived status like
   * `needs-work`, so the caller tells us whether one exists. */
  hasDeepAudit: boolean;
}

export interface StatusOutcome {
  status: ResultStatus;
  lightSuspect: boolean;
}

/**
 * DESIGN §5.4's status table, decided from light-check evidence alone (Phase 3's deep-audit
 * signals -- parked/offsite-redirect/Safe-Browsing for `hijacked`, blank/default-page/under-
 * construction for `broken` -- aren't available until then). Checked in this order: geo-block
 * suspicion first (never `down`, per §6.7), then an invalid TLS certificate (an immediate
 * `broken`, not two-strike-gated -- a citizen's browser blocks the page the very first time),
 * then the two-strike `down` rule for everything else DESIGN calls a light-check failure
 * (dns/connect/timeout/non-2xx final status).
 */
export function deriveStatus(input: StatusInput): StatusOutcome {
  const { previousStatus, previousLight, newLight, hasDeepAudit } = input;

  if (newLight.geo_block_suspect) {
    return { status: 'unverifiable', lightSuspect: false };
  }

  if (newLight.tls !== null && !newLight.tls.valid) {
    return { status: 'broken', lightSuspect: false };
  }

  if (!isLightFailure(newLight)) {
    return { status: hasDeepAudit ? previousStatus : 'unaudited', lightSuspect: false };
  }

  const previousFailed = previousLight !== null && isLightFailure(previousLight);
  if (previousFailed) {
    return { status: 'down', lightSuspect: false };
  }
  return { status: previousStatus, lightSuspect: true };
}
