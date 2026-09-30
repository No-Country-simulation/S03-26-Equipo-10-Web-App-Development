import { BlockList, isIP } from 'node:net';
import { InvalidInputError } from '../../../common/errors/application.error';

// IANA special-use and non-public ranges. A conservative denylist is safer
// than accepting addresses whose reachability depends on the deployment.
const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) {
  blockedV4.addSubnet(address, prefix, 'ipv4');
}

const publicV6 = new BlockList();
publicV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new BlockList();
for (const [address, prefix] of [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16],
] as const) {
  blockedV6.addSubnet(address, prefix, 'ipv6');
}

export function assertPublicIp(address: string): void {
  const family = isIP(address);
  const allowed = family === 4
    ? !blockedV4.check(address, 'ipv4')
    : family === 6
      ? publicV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6')
      : false;
  if (!allowed) {
    throw new InvalidInputError('Webhook destination must resolve to a public IP address');
  }
}

/** Validación de sintaxis. El DNS vuelve a validarse al abrir cada conexión. */
export function assertPublicUrl(value: string, allowLegacyHttp = false): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new InvalidInputError('Invalid webhook URL');
  }

  if (parsed.protocol !== 'https:' && !(allowLegacyHttp && parsed.protocol === 'http:')) {
    throw new InvalidInputError('Webhook URL must use HTTPS');
  }
  if (parsed.username || parsed.password || parsed.hash || !parsed.hostname || parsed.port === '0') {
    throw new InvalidInputError('Invalid webhook URL');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (
    hostname === 'localhost' || hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') || hostname.endsWith('.internal')
  ) {
    throw new InvalidInputError('Webhook destination must be public');
  }
  if (isIP(hostname)) assertPublicIp(hostname);

  return parsed;
}
