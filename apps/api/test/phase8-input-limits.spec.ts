import express from 'express';
import request from 'supertest';
import { boundedJsonBody, formBody, isImagePayloadRoute, isLogoPayloadRoute } from '../src/common/middleware/body-limits.middleware';
import { MAX_IMAGE_BYTES, validateImageBase64 } from '../src/modules/testimonials/utils/validate-image-base64';
import { parseAdminPage } from '../src/common/pagination/admin-page';

describe('bounded input and administrative pagination', () => {
  it('reserves the three MiB budget exclusively for PUT logo', async () => {
    const app = express();
    app.use(boundedJsonBody);
    app.all('/api/v1/tenants/me/logo', (req, res) => res.json({ length: req.body.imageBase64.length }));
    const body = { imageBase64: 'A'.repeat(2800000) };
    await request(app).put('/api/v1/tenants/me/logo').send(body).expect(200);
    await request(app).patch('/api/v1/tenants/me/logo').send(body).expect(413);
    await request(app).put('/api/v1/tenants/me/logo').send({ imageBase64: 'A'.repeat(3 * 1024 * 1024) }).expect(413);
    expect(isLogoPayloadRoute('PUT', '/api/v1/tenants/me/logo/')).toBe(true);
    expect(isLogoPayloadRoute('PUT', '/api/v1/tenants/other/logo')).toBe(false);
  });
  it('allows the image route a separate body budget while rejecting oversized general JSON', async () => {
    const app = express();
    app.use(boundedJsonBody, formBody);
    app.post('/api/v1/auth/login', (req, res) => res.json(req.body));
    app.post('/api/v1/testimonials/:id/image', (req, res) => res.json({ length: req.body.imageBase64.length }));
    const body = { imageBase64: 'A'.repeat(1024 * 1024 + 1024) };
    await request(app).post('/api/v1/auth/login').send(body).expect(413);
    await request(app).post('/api/v1/testimonials/id/image').send(body).expect(200);
    expect(isImagePayloadRoute('POST', '/api/v1/public/testimonials/slug/submit')).toBe(true);
    expect(isImagePayloadRoute('GET', '/api/v1/testimonials/id/image')).toBe(false);
  });

  it('rejects malformed and decoded images over ten MiB before upload', () => {
    expect(() => validateImageBase64('data:image/png;base64,' + Buffer.alloc(64).toString('base64'))).not.toThrow();
    expect(() => validateImageBase64('abc!')).toThrow();
    expect(() => validateImageBase64('A'.repeat(Math.ceil((MAX_IMAGE_BYTES + 1) / 3) * 4))).toThrow('10 MB');
  });

  it('caps admin pages and rejects negative, fractional, duplicated or huge offsets', () => {
    expect(parseAdminPage({})).toEqual({ page: 1, limit: 20 });
    expect(parseAdminPage({ page: '3', limit: '100' })).toEqual({ page: 3, limit: 100 });
    for (const query of [{ page: '-1' }, { page: '1.5' }, { page: ['1', '2'] },
      { limit: '101' }, { page: '10001' }]) {
      expect(() => parseAdminPage(query)).toThrow();
    }
  });
});
