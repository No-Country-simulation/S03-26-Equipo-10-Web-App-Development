import { InvalidInputError } from '../../../common/errors/application.error';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const WATCH_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);

export function parseYoutubeUrl(value: string): { videoId: string; canonicalUrl: string } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InvalidInputError('Only valid YouTube URLs are supported');
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new InvalidInputError('Only valid YouTube URLs are supported');
  }

  let videoId: string | null = null;
  if (url.hostname === 'youtu.be' && /^\/[A-Za-z0-9_-]{11}$/.test(url.pathname)) {
    videoId = url.pathname.slice(1);
  } else if (WATCH_HOSTS.has(url.hostname) && url.pathname === '/watch' && url.searchParams.getAll('v').length === 1) {
    videoId = url.searchParams.get('v');
  }

  if (!videoId || !VIDEO_ID.test(videoId)) {
    throw new InvalidInputError('Only valid YouTube URLs are supported');
  }

  return { videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}` };
}
