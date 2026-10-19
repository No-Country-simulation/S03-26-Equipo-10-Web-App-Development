import { expect, it } from 'vitest';
import { safePublicMediaUrl, youtubeVideoId } from './public-media';
it('accepts supported YouTube URLs and rejects unsupported, credential-bearing or unsafe URLs', () => {
  for (const url of [
    'https://youtu.be/abcdefghijk',
    'https://www.youtube.com/watch?v=abcdefghijk',
  ])
    expect(youtubeVideoId(url)).toBe('abcdefghijk');
  for (const url of [
    'http://youtu.be/abcdefghijk',
    'https://youtube.com/shorts/abcdefghijk',
    'https://youtube.com/watch?v=abcdefghijk&v=12345678901',
    'https://user:password@youtube.com/watch?v=abcdefghijk',
    'javascript:alert(1)',
  ])
    expect(youtubeVideoId(url)).toBeNull();
  expect(safePublicMediaUrl('javascript:alert(1)')).toBeNull();
  expect(safePublicMediaUrl('https://media.example.invalid/file')).toBe(
    'https://media.example.invalid/file',
  );
});
