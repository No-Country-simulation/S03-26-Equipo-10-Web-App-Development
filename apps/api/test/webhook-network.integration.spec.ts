import { createServer, type Server } from 'node:http';
import type { LookupAddress } from 'node:dns';
import type { ConfigService } from '@nestjs/config';
import { HttpResilienceService } from '../src/modules/webhooks/services/http-resilience.service';
import { WebhookDestinationPolicy } from '../src/modules/webhooks/services/webhook-destination-policy';

const config = { get: () => ({ webhookLegacyHttpStartedAt: null }) } as unknown as ConfigService;

class FakeDnsPolicy extends WebhookDestinationPolicy {
  addresses: LookupAddress[] = [];

  protected override async resolveAll(): Promise<LookupAddress[]> {
    return this.addresses;
  }
}

// Aísla el comportamiento del cliente HTTP: la política IP se prueba aparte.
class LocalTransportPolicy extends WebhookDestinationPolicy {
  override async resolvePublicAddresses(): Promise<LookupAddress[]> {
    return [{ address: '127.0.0.1', family: 4 }];
  }
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP server address');
  return address.port;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>(resolve => server.close(() => resolve()));
}

describe('webhook delivery network boundary', () => {
  it('no abre conexión si DNS cambia a loopback al conectar', async () => {
    let hits = 0;
    const server = createServer((_req, res) => { hits += 1; res.end('unexpected'); });
    const port = await listen(server);
    try {
      const policy = new FakeDnsPolicy(config);
      policy.addresses = [{ address: '1.1.1.1', family: 4 }];
      await policy.validateNewUrl('https://hooks.example.test/hook');
      policy.addresses = [{ address: '127.0.0.1', family: 4 }];

      const transport = new HttpResilienceService(policy);
      await expect(transport.postText(`http://hooks.example.test:${port}/hook`, '{}', {}, {
        circuitKey: 'rebind', allowLegacyHttp: true, retries: 0,
      })).rejects.toThrow();
      expect(hits).toBe(0);
    } finally {
      await close(server);
    }
  });

  it('no visita el Location privado de una respuesta 302', async () => {
    let targetHits = 0;
    const target = createServer((_req, res) => { targetHits += 1; res.end('metadata'); });
    const targetPort = await listen(target);
    const source = createServer((_req, res) => {
      res.writeHead(302, { Location: `http://127.0.0.1:${targetPort}/metadata` });
      res.end();
    });
    const sourcePort = await listen(source);
    try {
      const transport = new HttpResilienceService(new LocalTransportPolicy(config));
      const response = await transport.postText(`http://hooks.example.test:${sourcePort}/hook`, '{}', {}, {
        circuitKey: 'redirect', allowLegacyHttp: true, retries: 0,
      });
      expect(response.status).toBe(302);
      expect(targetHits).toBe(0);
    } finally {
      await close(source);
      await close(target);
    }
  });
});
