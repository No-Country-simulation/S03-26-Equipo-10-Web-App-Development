import {
  ConflictError,
  NotFoundError,
} from '../src/common/errors/application.error';
import { WebhooksService } from '../src/modules/webhooks/services/webhooks.service';

describe('webhook administration retains activation constraints', () => {
  const date = new Date('2026-09-29T12:00:00Z');
  const signed = {
    id: 'destination',
    tenantId: 'own',
    url: 'https://receiver.example.invalid/hooks',
    eventCode: 'testimonial.created',
    isActive: false,
    createdAt: date,
    updatedAt: date,
    deletedAt: null,
    hasSignature: true,
    signatureGraceUntil: null,
  };
  const repo = { findById: jest.fn(), update: jest.fn() };
  const policy = {
    validateNewUrl: jest.fn().mockResolvedValue(undefined),
    allowsLegacyHttp: () => false,
    legacyHttpDeadline: () => date,
  };
  const secrets = { legacyAllowed: () => false, legacyDeadline: () => date };
  const service = new WebhooksService(
    repo as any,
    {} as any,
    policy as any,
    secrets as any,
  );
  beforeEach(() => {
    repo.findById.mockReset();
    repo.update.mockReset();
    policy.validateNewUrl.mockClear();
  });
  it('refuses expired unsigned reactivation before persistence', async () => {
    repo.findById.mockResolvedValue({ ...signed, hasSignature: false });
    await expect(
      service.updateWebhook('own', 'destination', { isActive: true }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('refuses expired HTTP reactivation without a new HTTPS destination', async () => {
    repo.findById.mockResolvedValue({
      ...signed,
      url: 'http://receiver.example.invalid/hooks',
    });
    await expect(
      service.updateWebhook('own', 'destination', { isActive: true }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('validates a new HTTPS destination before allowing signed reactivation', async () => {
    repo.findById.mockResolvedValue({
      ...signed,
      url: 'http://receiver.example.invalid/hooks',
    });
    repo.update.mockResolvedValue({ ...signed, isActive: true });
    await expect(
      service.updateWebhook('own', 'destination', {
        url: signed.url,
        isActive: true,
      }),
    ).resolves.toMatchObject({ isActive: true, url: signed.url });
    expect(policy.validateNewUrl).toHaveBeenCalledWith(signed.url);
    expect(repo.update).toHaveBeenCalledWith('own', 'destination', {
      url: signed.url,
      isActive: true,
    });
  });
  it('rejects another tenant before validating or writing a destination', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(
      service.updateWebhook('other', 'destination', { url: signed.url }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.findById).toHaveBeenCalledWith('other', 'destination');
    expect(repo.update).not.toHaveBeenCalled();
    expect(policy.validateNewUrl).not.toHaveBeenCalled();
  });
});
