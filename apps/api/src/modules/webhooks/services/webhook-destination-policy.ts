import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import type { AppConfig } from '../../../config/app.config';
import { InvalidInputError } from '../../../common/errors/application.error';
import { assertPublicIp, assertPublicUrl } from '../utils/assert-public-url';

const LEGACY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class WebhookDestinationPolicy {
  constructor(private readonly config: ConfigService) {}

  async validateNewUrl(url: string): Promise<void> {
    const parsed = assertPublicUrl(url);
    await this.resolvePublicAddresses(this.hostname(parsed));
  }

  legacyHttpDeadline(createdAt: Date): Date | null {
    const startedAt = this.config.get<AppConfig>('app')?.webhookLegacyHttpStartedAt;
    if (!startedAt) return null;
    const start = new Date(startedAt).getTime();
    return createdAt.getTime() <= start ? new Date(start + LEGACY_WINDOW_MS) : null;
  }

  allowsLegacyHttp(createdAt: Date, now = Date.now()): boolean {
    const deadline = this.legacyHttpDeadline(createdAt);
    if (!deadline) return false;
    const start = deadline.getTime() - LEGACY_WINDOW_MS;
    return now >= start && now < deadline.getTime();
  }

  createAgent(url: string, allowLegacyHttp = false): HttpAgent | HttpsAgent {
    const parsed = assertPublicUrl(url, allowLegacyHttp);
    const options = { keepAlive: false, lookup: this.createPinnedLookup() };
    return parsed.protocol === 'https:' ? new HttpsAgent(options) : new HttpAgent(options);
  }

  /** Node llama este resolver al abrir cada socket; solo recibe la IP validada. */
  createPinnedLookup(): LookupFunction {
    return (hostname, options, callback) => {
      void this.resolvePublicAddresses(hostname).then(
        addresses => {
          const eligible = addresses.filter(address => !options.family || address.family === options.family);
          // El despliegue actual usa subredes IPv4; preferir A si existe.
          const selected = eligible.find(address => address.family === 4) ?? eligible[0];
          if (!selected) {
            callback(Object.assign(new Error('No public address for requested family'), { code: 'ENOTFOUND' }), '', 0);
            return;
          }
          if (options.all) callback(null, [selected]);
          else callback(null, selected.address, selected.family);
        },
        error => callback(error as NodeJS.ErrnoException, '', 0),
      );
    };
  }

  async resolvePublicAddresses(hostname: string): Promise<LookupAddress[]> {
    const normalized = hostname.replace(/^\[|\]$/g, '');
    const addresses = await this.resolveAll(normalized);
    if (addresses.length === 0) {
      throw new InvalidInputError('Webhook destination has no DNS addresses');
    }
    for (const address of addresses) assertPublicIp(address.address);
    return addresses;
  }

  protected async resolveAll(hostname: string): Promise<LookupAddress[]> {
    const family = isIP(hostname);
    if (family) return [{ address: hostname, family }];
    return dnsLookup(hostname, { all: true, order: 'verbatim' });
  }

  private hostname(url: URL): string {
    return url.hostname.replace(/^\[|\]$/g, '');
  }
}
