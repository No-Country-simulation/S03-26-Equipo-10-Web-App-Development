import { serializeSafeRequest } from '../src/common/observability/safe-request-serializer';

describe('serializeSafeRequest', () => {
  it('omits URLs, query values, headers and bodies from request-bound logs', () => {
    const request = {
      id: 'request-id', method: 'GET',
      url: '/testimonials?token=private-value',
      headers: { authorization: 'Bearer private-value' },
      body: { password: 'private-value' },
    };
    const serialized = serializeSafeRequest(request);

    expect(serialized).toEqual({ requestId: 'request-id', method: 'GET' });
    expect(JSON.stringify(serialized)).not.toContain('private-value');
  });
});
