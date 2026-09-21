import { connect, checkServerIdentity, type PeerCertificate } from 'node:tls';
import { isIP } from 'node:net';

export interface TlsInfo {
  attempted: boolean;
  connected: boolean;
  authorized: boolean;
  authorizationError: string | null;
  hostnameMatch: boolean | null;
  protocol: string | null;
  validTo: string | null;
  daysLeft: number | null;
  issuer: string | null;
  error: string | null;
}

const NOT_ATTEMPTED: TlsInfo = {
  attempted: false,
  connected: false,
  authorized: false,
  authorizationError: null,
  hostnameMatch: null,
  protocol: null,
  validTo: null,
  daysLeft: null,
  issuer: null,
  error: null,
};

/**
 * Connects with `rejectUnauthorized: false` so an expired or self-signed cert is captured as
 * evidence (site avail.dns/connect can still pass) rather than thrown -- validity is evaluated
 * separately from the handshake itself, per DESIGN §5.1 step 1.
 */
export function checkTls(hostname: string, opts: { port?: number; timeoutMs?: number } = {}): Promise<TlsInfo> {
  const port = opts.port ?? 443;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  // SNI is meaningless for a numeric IP (RFC 6066) -- Node warns and ignores it anyway, so skip
  // it outright rather than let the warning fire on every registry entry with an IP-literal host.
  const servername = isIP(hostname) ? undefined : hostname;

  return new Promise((resolve) => {
    const socket = connect({ host: hostname, port, servername, rejectUnauthorized: false, timeout: timeoutMs });
    let settled = false;
    const finish = (result: TlsInfo) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      finish({
        attempted: true,
        connected: true,
        authorized: socket.authorized,
        authorizationError: socket.authorized ? null : String(socket.authorizationError ?? 'unknown'),
        hostnameMatch: hasCertData(cert) ? checkServerIdentity(hostname, cert) === undefined : null,
        protocol: socket.getProtocol(),
        validTo: hasCertData(cert) ? cert.valid_to : null,
        daysLeft: hasCertData(cert) ? daysUntil(cert.valid_to) : null,
        issuer: hasCertData(cert) ? formatIssuer(cert) : null,
        error: null,
      });
    });
    socket.once('timeout', () => finish({ ...NOT_ATTEMPTED, attempted: true, error: 'timeout' }));
    socket.once('error', (err) => finish({ ...NOT_ATTEMPTED, attempted: true, error: err.message }));
  });
}

function hasCertData(cert: PeerCertificate): boolean {
  return Boolean(cert && Object.keys(cert).length > 0);
}

function daysUntil(validTo: string): number {
  return Math.round((new Date(validTo).getTime() - Date.now()) / 86_400_000);
}

function formatIssuer(cert: PeerCertificate): string {
  const org = cert.issuer?.O ?? cert.issuer?.CN ?? 'unknown';
  return Array.isArray(org) ? org.join(', ') : org;
}
