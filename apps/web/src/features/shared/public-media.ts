/** Mirrors the supported YouTube URL shapes; validation remains authoritative in the API. */
export function youtubeVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
      return null;
    let id: string | null = null;
    if (
      url.hostname === 'youtu.be' &&
      /^\/[A-Za-z0-9_-]{11}$/.test(url.pathname)
    )
      id = url.pathname.slice(1);
    else if (
      ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(
        url.hostname,
      ) &&
      url.pathname === '/watch' &&
      url.searchParams.getAll('v').length === 1
    )
      id = url.searchParams.get('v');
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function safePublicMediaUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
