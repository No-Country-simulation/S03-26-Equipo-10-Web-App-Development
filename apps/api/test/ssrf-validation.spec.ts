import { InvalidInputError } from '../src/common/errors/application.error';

import { assertPublicIp, assertPublicUrl } from '../src/modules/webhooks/utils/assert-public-url';

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
    'https://[::ffff:127.0.0.1]/hook',
    'https://2130706433/hook',
    'https://localhost./hook',
    'https://hooks.local/hook',
    'https://100.64.0.1/hook',
    'https://198.18.0.1/hook',
    'https://192.0.2.1/hook',
    'https://[fc00::1]/hook',
    'https://[fe80::1]/hook',
    'https://[2001:db8::1]/hook',
    'https://[2002:c0a8:101::]/hook',
  ];

  const allowed = [
    'https://hooks.example.com/webhook',
    'https://api.stripe.com/v1/webhook',
    'https://1.1.1.1:8443/callback',
    'https://my-app.ngrok.io/webhooks',
    'https://[2606:4700:4700::1111]/hook',
  ];

  it.each(blocked)('blocks private URL: %s', (url) => {
    expect(() => assertPublicUrl(url)).toThrow(InvalidInputError);
  });

  it.each(allowed)('allows public URL: %s', (url) => {
    expect(() => assertPublicUrl(url)).not.toThrow();
  });

  it('rejects non-HTTP protocols', () => {
    expect(() => assertPublicUrl('ftp://example.com/hook')).toThrow(InvalidInputError);
    expect(() => assertPublicUrl('file:///etc/passwd')).toThrow(InvalidInputError);
  });

  it('rejects malformed URLs', () => {
    expect(() => assertPublicUrl('not-a-url')).toThrow(InvalidInputError);
    expect(() => assertPublicUrl('')).toThrow(InvalidInputError);
  });

  it('requires HTTPS for new destinations and allows public HTTP only during legacy grace', () => {
    expect(() => assertPublicUrl('http://1.1.1.1/hook')).toThrow(InvalidInputError);
    expect(() => assertPublicUrl('http://1.1.1.1/hook', true)).not.toThrow();
    expect(() => assertPublicUrl('http://127.0.0.1/hook', true)).toThrow(InvalidInputError);
    expect(() => assertPublicUrl('https://user:pass@hooks.example.com/hook')).toThrow(InvalidInputError);
    expect(() => assertPublicUrl('https://hooks.example.com/hook#fragment')).toThrow(InvalidInputError);
  });

  it.each(['::1', '::ffff:7f00:1', 'fd00:ec2::254', '8.8.8.8'])('classifies IP ranges: %s', ip => {
    if (ip === '8.8.8.8') expect(() => assertPublicIp(ip)).not.toThrow();
    else expect(() => assertPublicIp(ip)).toThrow(InvalidInputError);
  });
});
