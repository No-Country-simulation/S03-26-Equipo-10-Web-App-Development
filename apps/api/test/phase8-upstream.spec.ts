import axios from 'axios';
import { HttpResilienceService } from '../src/modules/webhooks/services/http-resilience.service';
import { YoutubeService } from '../src/modules/shared/cloud/youtube.service';
import { CloudinaryService } from '../src/modules/shared/cloud/cloudinary.service';

jest.mock('axios', () => {
  const mocked = jest.fn();
  (mocked as typeof mocked & { isAxiosError: (error: { isAxiosError?: boolean }) => boolean }).isAxiosError =
    error => error.isAxiosError === true;
  return { __esModule: true, default: mocked, AxiosError: Error };
});

describe('Cloudinary and YouTube upstream resilience', () => {
  const mockedAxios = axios as jest.MockedFunction<typeof axios>;
  beforeEach(() => mockedAxios.mockReset());

  it('does not retry permanent 4xx or expose URL credentials in errors', async () => {
    mockedAxios.mockRejectedValue({ isAxiosError: true, response: { status: 403 },
      message: 'https://upstream.test?key=secret-value' });
    const transport = new HttpResilienceService({} as any);
    await expect(transport.request('https://upstream.test?key=secret-value', { method: 'GET' },
      { circuitKey: 'upstream', retries: 3 })).rejects.toThrow('Upstream HTTP 403');
    expect(mockedAxios).toHaveBeenCalledTimes(1);
  });

  it('retries a 503, then succeeds without implicit redirects or proxies', async () => {
    mockedAxios.mockRejectedValueOnce({ isAxiosError: true, response: { status: 503 } })
      .mockResolvedValueOnce({ data: { ok: true } });
    const transport = new HttpResilienceService({} as any);
    await expect(transport.request('https://upstream.test', { method: 'GET' },
      { circuitKey: 'upstream', retries: 1, baseDelayMs: 0 })).resolves.toEqual({ ok: true });
    expect(mockedAxios).toHaveBeenCalledTimes(2);
    expect(mockedAxios.mock.calls[0]![0]).toMatchObject({ maxRedirects: 0, proxy: false });
  });

  it('sends the YouTube key in a header, never in the URL', async () => {
    const http = { request: jest.fn().mockResolvedValue({ items: [] }) };
    const youtube = new YoutubeService(http as any, { get: () => ({ youtube: { apiKey: 'synthetic-key' } }) } as any);
    await youtube.getVideoMetadata('https://youtu.be/dQw4w9WgXcQ');
    expect(http.request.mock.calls[0][0]).not.toContain('synthetic-key');
    expect(http.request.mock.calls[0][1].headers['X-Goog-Api-Key']).toBe('synthetic-key');
  });

  it('rejects a Cloudinary URL that embeds credentials or query values', () => {
    const config = (uploadUrl: string) => ({ get: () => ({ cloudinary: { uploadUrl, uploadPreset: 'preset' } }) });
    expect(() => new CloudinaryService({} as any, config('https://user:secret@api.cloudinary.com/upload') as any))
      .toThrow('without credentials');
    expect(() => new CloudinaryService({} as any, config('https://api.cloudinary.com/upload?token=secret') as any))
      .toThrow('without credentials');
    expect(() => new CloudinaryService({} as any, config('https://api.cloudinary.com/upload') as any))
      .not.toThrow();
  });

  it('does not retry a Cloudinary POST after a network timeout', async () => {
    mockedAxios.mockRejectedValue({ isAxiosError: true, message: 'timeout' });
    const transport = new HttpResilienceService({} as any);
    const cloudinary = new CloudinaryService(transport, { get: () => ({
      cloudinary: { uploadUrl: 'https://api.cloudinary.com/upload', uploadPreset: 'preset' },
    }) } as any);

    await expect(cloudinary.uploadImage('data:image/png;base64,AAAA'))
      .rejects.toThrow('Upstream network error');
    expect(mockedAxios).toHaveBeenCalledTimes(1);
    expect(mockedAxios.mock.calls[0]![0]).toMatchObject({ method: 'POST', maxRedirects: 0 });
  });

  it('rejects malformed or non-Cloudinary upload responses', async () => {
    const http = { request: jest.fn().mockResolvedValueOnce({ secure_url: 'https://evil.test/image.png', public_id: 'one' })
      .mockResolvedValueOnce({ secure_url: 'https://res.cloudinary.com/account/image.png' })
      .mockResolvedValueOnce({ secure_url: 'https://res.cloudinary.com/account/image.png', public_id: 'one' }) };
    const cloudinary = new CloudinaryService(http as any, { get: () => ({
      cloudinary: { uploadUrl: 'https://api.cloudinary.com/upload', uploadPreset: 'preset' },
    }) } as any);

    await expect(cloudinary.uploadImage('image')).rejects.toThrow('Invalid Cloudinary upload response');
    await expect(cloudinary.uploadImage('image')).rejects.toThrow('Invalid Cloudinary upload response');
    await expect(cloudinary.uploadImage('image')).resolves.toEqual({
      secureUrl: 'https://res.cloudinary.com/account/image.png', publicId: 'one',
    });
    expect(http.request).toHaveBeenCalledWith(expect.any(String), expect.any(Object),
      expect.objectContaining({ retries: 0 }));
  });
});
