import type { LookupAddress, LookupOptions } from 'node:dns';
import type { ConfigService } from '@nestjs/config';
import { WebhookDestinationPolicy } from '../src/modules/webhooks/services/webhook-destination-policy';
import { InvalidInputError } from '../src/common/errors/application.error';

class StubPolicy extends WebhookDestinationPolicy {
  addresses: LookupAddress[] = [{ address: '1.1.1.1', family: 4 }];
  resolves = 0;

  protected override async resolveAll(): Promise<LookupAddress[]> {
    this.resolves += 1;
    return this.addresses;
  }
}

function lookup(policy: WebhookDestinationPolicy, hostname: string, options: LookupOptions = {}): Promise<LookupAddress[]> {
  return new Promise((resolve, reject) => {
    policy.createPinnedLookup()(hostname, options, (error, address, family) => {
      if (error) return reject(error);
      if (Array.isArray(address)) return resolve(address);
      resolve([{ address, family: family ?? 0 }]);
    });
  });
}

describe('WebhookDestinationPolicy', () => {
  const startedAt = '2026-09-30T12:00:00Z';
  const config = { get: () => ({ webhookLegacyHttpStartedAt: startedAt }) } as unknown as ConfigService;
  let policy: StubPolicy;

  beforeEach(() => { policy = new StubPolicy(config); });

  it('rechaza todo el DNS si una respuesta A o AAAA es privada', async () => {
    policy.addresses = [
      { address: '1.1.1.1', family: 4 },
      { address: 'fd00::1', family: 6 },
    ];
    await expect(policy.validateNewUrl('https://hooks.example.com/hook')).rejects.toThrow(InvalidInputError);
    await expect(lookup(policy, 'hooks.example.com', { all: true })).rejects.toThrow(InvalidInputError);
  });

  it('vuelve a resolver al conectar y bloquea un rebinding hacia IP interna', async () => {
    await policy.validateNewUrl('https://hooks.example.com/hook');
    policy.addresses = [{ address: '10.1.2.3', family: 4 }];
    await expect(lookup(policy, 'hooks.example.com')).rejects.toThrow(InvalidInputError);
    expect(policy.resolves).toBe(2);
  });

  it('fija una sola IP validada para el socket aun con A y AAAA públicos', async () => {
    policy.addresses = [
      { address: '2606:4700:4700::1111', family: 6 },
      { address: '1.1.1.1', family: 4 },
    ];
    await expect(lookup(policy, 'hooks.example.com', { all: true })).resolves.toEqual([
      { address: '1.1.1.1', family: 4 },
    ]);
    await expect(lookup(policy, 'hooks.example.com', { all: true, family: 6 })).resolves.toEqual([
      { address: '2606:4700:4700::1111', family: 6 },
    ]);
  });

  it('solo permite HTTP para registros previos durante 30 días desde el despliegue', () => {
    const old = new Date('2026-09-29T23:00:00Z');
    const newRecord = new Date('2026-09-30T13:00:00Z');
    expect(policy.allowsLegacyHttp(old, Date.parse('2026-10-01T12:00:00Z'))).toBe(true);
    expect(policy.allowsLegacyHttp(newRecord, Date.parse('2026-10-01T12:00:00Z'))).toBe(false);
    expect(policy.allowsLegacyHttp(old, Date.parse('2026-10-30T12:00:00Z'))).toBe(false);
    expect(policy.legacyHttpDeadline(old)?.toISOString()).toBe('2026-10-30T12:00:00.000Z');
    const noWindow = new WebhookDestinationPolicy({ get: () => ({ webhookLegacyHttpStartedAt: null }) } as unknown as ConfigService);
    expect(noWindow.allowsLegacyHttp(old, Date.parse('2026-10-01T12:00:00Z'))).toBe(false);
  });
});
