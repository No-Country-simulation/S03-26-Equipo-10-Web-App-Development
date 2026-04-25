import { BadRequestException } from '@nestjs/common';
import { assertPublicUrl } from '../src/modules/webhooks/utils/assert-public-url';

describe('assertPublicUrl (SSRF Prevention)', () => {
  const blocked = [
    'http://localhost/webhook',
    'http://127.0.0.1/hook',
    'http://127.0.0.2:8080/callback',
    'http://10.0.0.1/internal',
    'http://10.255.255.255/hook',
    'http://172.16.0.1/internal',
    'http://172.31.255.255/internal',
    'http://192.168.0.1/private',
    'http://192.168.1.100:3000/hook',
    'http://169.254.169.254/latest/meta-data/',
    'http://0.0.0.0/hook',
    'http://[::1]/hook',
  ];

  const allowed = [
    'https://hooks.example.com/webhook',
    'https://api.stripe.com/v1/webhook',
    'http://203.0.113.50:8080/callback',
    'https://my-app.ngrok.io/webhooks',
  ];

  it.each(blocked)('blocks private URL: %s', (url) => {
    expect(() => assertPublicUrl(url)).toThrow(BadRequestException);
  });

  it.each(allowed)('allows public URL: %s', (url) => {
    expect(() => assertPublicUrl(url)).not.toThrow();
  });

  it('rejects non-HTTP protocols', () => {
    expect(() => assertPublicUrl('ftp://example.com/hook')).toThrow(BadRequestException);
    expect(() => assertPublicUrl('file:///etc/passwd')).toThrow(BadRequestException);
  });

  it('rejects malformed URLs', () => {
    expect(() => assertPublicUrl('not-a-url')).toThrow(BadRequestException);
    expect(() => assertPublicUrl('')).toThrow(BadRequestException);
  });
});
