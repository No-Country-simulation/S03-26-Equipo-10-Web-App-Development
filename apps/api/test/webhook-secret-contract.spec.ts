import { createHmac } from 'node:crypto';
import { WebhookSecretService } from '../src/modules/webhooks/services/webhook-secret.service';
import { HttpWebhookDispatcher } from '../src/modules/webhooks/services/http-webhook-dispatcher';
import { signWebhookBody, verifyWebhookSignature } from '../src/modules/webhooks/utils/webhook-signature';
import { redactDeliveryText } from '../src/modules/webhooks/utils/redact-delivery-text';

describe('versioned outgoing webhook contract', () => {
  const settings = {
    webhookSignatureLegacyStartedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    webhookSecrets: { currentKeyVersion: 2, keys: {
      '1': Buffer.alloc(32, 1).toString('base64url'),
      '2': Buffer.alloc(32, 2).toString('base64url'),
    } },
  };
  const secrets = new WebhookSecretService({ getOrThrow: () => settings } as any);

  it('encrypts each secret with a versioned key and destination-bound AAD', () => {
    const issued = secrets.issue();
    expect(issued).toMatch(/^whsec_[0-9a-f]{64}$/);
    const encrypted = secrets.encrypt('tenant-1', 'webhook-1', issued);
    expect(encrypted.keyVersion).toBe(2);
    expect(encrypted.ciphertext).not.toContain(issued);
    expect(secrets.decrypt('tenant-1', 'webhook-1', encrypted)).toBe(issued);
    expect(() => secrets.decrypt('tenant-2', 'webhook-1', encrypted)).toThrow('Webhook secret unavailable');
    expect(() => secrets.decrypt('tenant-1', 'webhook-2', encrypted)).toThrow('Webhook secret unavailable');
    const firstChar = encrypted.ciphertext[0] === 'A' ? 'B' : 'A';
    expect(() => secrets.decrypt('tenant-1', 'webhook-1', {
      ...encrypted, ciphertext: firstChar + encrypted.ciphertext.slice(1),
    })).toThrow('Webhook secret unavailable');
  });

  it('verifies exact body bytes, timestamp and either signature during rotation', () => {
    const body = Buffer.from('{"á":1}', 'utf8');
    const timestamp = 1_800_000_000;
    const old = secrets.issue();
    const current = secrets.issue();
    const header = `t=${timestamp},v1=${signWebhookBody(body, timestamp, current)},v1=${signWebhookBody(body, timestamp, old)}`;
    expect(verifyWebhookSignature(body, header, current, timestamp)).toBe(true);
    expect(verifyWebhookSignature(body, header, old, timestamp + 300)).toBe(true);
    expect(verifyWebhookSignature(Buffer.from('{"á":2}'), header, current, timestamp)).toBe(false);
    expect(verifyWebhookSignature(body, header, old, timestamp + 301)).toBe(false);
    expect(verifyWebhookSignature(body, header.replace(/v1=[0-9a-f]{64}/g, 'v1=bad'), old, timestamp)).toBe(false);
  });

  it('emits the new contract and legacy header only in the migration window', async () => {
    const http = { postText: jest.fn().mockResolvedValue({ status: 200, body: '' }) };
    const logger = { warn: jest.fn() };
    const policy = { allowsLegacyHttp: jest.fn(), legacyHttpDeadline: jest.fn() };
    const dispatcher = new HttpWebhookDispatcher(http as any, logger as any, policy as any, secrets);
    const oldSecret = secrets.issue();
    const newSecret = secrets.issue();
    const createdAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const webhook = {
      id: 'webhook-1', tenantId: 'tenant-1', url: 'https://hooks.example.test',
      eventCode: 'testimonial.created', isActive: true, createdAt, updatedAt: createdAt,
      deletedAt: null, hasSignature: true, signatureGraceUntil: new Date(Date.now() + 60_000),
      secret: null, secretCiphertext: secrets.encrypt('tenant-1', 'webhook-1', newSecret).ciphertext,
      secretKeyVersion: 2,
      previousSecretCiphertext: secrets.encrypt('tenant-1', 'webhook-1', oldSecret).ciphertext,
      previousSecretKeyVersion: 2, previousSecretValidUntil: new Date(Date.now() + 60_000),
    };
    const payload = { id: 'event-1', schemaVersion: 1, eventType: 'testimonial.created' };
    await dispatcher.dispatch(webhook, payload, 'event-1');
    const [,, headers] = http.postText.mock.calls[0] as [string, string, Record<string, string>];
    const body = Buffer.from(JSON.stringify(payload));
    expect(headers['X-TMS-Event-Id']).toBe('event-1');
    expect(headers['X-TMS-Schema-Version']).toBe('1');
    expect(verifyWebhookSignature(body, headers['X-TMS-Signature']!, newSecret)).toBe(true);
    expect(verifyWebhookSignature(body, headers['X-TMS-Signature']!, oldSecret)).toBe(true);
    // The old receiver keeps its original key until its 24-hour rotation grace ends.
    expect(headers['X-Signature']).toBe(createHmac('sha256', oldSecret).update(body).digest('hex'));

    const modern = { ...webhook, createdAt: new Date(),
      previousSecretCiphertext: null, previousSecretKeyVersion: null, previousSecretValidUntil: null };
    await dispatcher.dispatch(modern, payload, 'event-1');
    expect(http.postText.mock.calls[1][2]['X-Signature']).toBeUndefined();
  });

  it('redacts echoed credentials and blocks expired unsigned destinations', async () => {
    const secret = secrets.issue();
    const http = { postText: jest.fn().mockResolvedValue({ status: 500,
      body: `{"secret":"${secret}","token":"abc"}` }) };
    const dispatcher = new HttpWebhookDispatcher(http as any, { warn: jest.fn() } as any,
      { allowsLegacyHttp: jest.fn() } as any, secrets);
    const createdAt = new Date();
    const base = { id: 'webhook-1', tenantId: 'tenant-1', url: 'https://hooks.example.test',
      eventCode: 'testimonial.created', isActive: true, createdAt, updatedAt: createdAt,
      deletedAt: null, hasSignature: true, signatureGraceUntil: null, secret: null,
      secretCiphertext: secrets.encrypt('tenant-1', 'webhook-1', secret).ciphertext,
      secretKeyVersion: 2, previousSecretCiphertext: null, previousSecretKeyVersion: null,
      previousSecretValidUntil: null };
    const result = await dispatcher.dispatch(base, { id: 'event-1' }, 'event-1');
    expect(result.body).not.toContain(secret);
    expect(result.body).toContain('[REDACTED]');
    expect(redactDeliveryText(`Bearer abc?token=x ${'x'.repeat(3000)}`)!.length).toBeLessThanOrEqual(2048);
    const unsigned = { ...base, secretCiphertext: null, secretKeyVersion: null, hasSignature: false };
    await expect(dispatcher.dispatch(unsigned, { id: 'event-1' }, 'event-1')).resolves.toMatchObject({ status: 410 });
    expect(http.postText).toHaveBeenCalledTimes(1);
  });

  it('stops the legacy signature after 30 days and redacts transport errors in logs', async () => {
    const expired = new WebhookSecretService({ getOrThrow: () => ({ ...settings,
      webhookSignatureLegacyStartedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    }) } as any);
    const secret = expired.issue();
    const http = { postText: jest.fn().mockRejectedValue(new Error(`request failed: ${secret}`)) };
    const logger = { warn: jest.fn() };
    const dispatcher = new HttpWebhookDispatcher(http as any, logger as any,
      { allowsLegacyHttp: jest.fn() } as any, expired);
    const createdAt = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000);
    const webhook = { id: 'webhook-old', tenantId: 'tenant-1', url: 'https://hooks.example.test',
      eventCode: 'testimonial.created', isActive: true, createdAt, updatedAt: createdAt,
      deletedAt: null, hasSignature: true, signatureGraceUntil: null, secret: null,
      secretCiphertext: expired.encrypt('tenant-1', 'webhook-old', secret).ciphertext,
      secretKeyVersion: 2, previousSecretCiphertext: null, previousSecretKeyVersion: null,
      previousSecretValidUntil: null };
    const result = await dispatcher.dispatch(webhook, { id: 'event-1' }, 'event-1');
    expect(http.postText.mock.calls[0][2]['X-Signature']).toBeUndefined();
    expect(result.errorMessage).not.toContain(secret);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(secret);
  });
});
