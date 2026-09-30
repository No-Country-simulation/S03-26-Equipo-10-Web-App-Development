import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { HttpResilienceService } from '../src/modules/webhooks/services/http-resilience.service';
import { WebhookDestinationPolicy } from '../src/modules/webhooks/services/webhook-destination-policy';

describe('webhook HTTP transport', () => {
  const policy = new WebhookDestinationPolicy({ get: () => ({ webhookLegacyHttpStartedAt: null }) } as unknown as ConfigService);
  const transport = new HttpResilienceService(policy);

  afterEach(() => jest.restoreAllMocks());

  it('no sigue una redirección y desactiva proxies implícitos', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({
      status: 302, data: 'redirect', headers: { location: 'http://169.254.169.254/latest/meta-data/' },
    });
    const result = await transport.postText('https://hooks.example.com/hook', '{}', {}, {
      circuitKey: 'redirect', retries: 0,
    });

    expect(result.status).toBe(302);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('https://hooks.example.com/hook', '{}', expect.objectContaining({
      maxRedirects: 0,
      proxy: false,
      httpsAgent: expect.objectContaining({ options: expect.objectContaining({ lookup: expect.any(Function) }) }),
    }));
  });

  it('rechaza una IP interna antes de invocar el transporte HTTP', async () => {
    const post = jest.spyOn(axios, 'post');
    await expect(transport.postText('https://127.0.0.1/hook', '{}', {}, {
      circuitKey: 'private', retries: 0,
    })).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });
});
