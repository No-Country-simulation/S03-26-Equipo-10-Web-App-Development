import { Injectable } from '@nestjs/common';
import { HttpResilienceService } from '../http-resilience/http-resilience.service';

interface YouTubeMetadata {
  title: string;
  thumbnailUrl: string;
  duration: string;
}

@Injectable()
export class YouTubeAdapter {
  constructor(private readonly http: HttpResilienceService) {}

  async getVideoMetadata(url: string): Promise<YouTubeMetadata | null> {
    const videoId = this.extractVideoId(url);
    if (!videoId || !process.env.YOUTUBE_API_KEY) {
      return null;
    }

    const endpoint = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${process.env.YOUTUBE_API_KEY}`;

    const response = await this.http.request<{ items: Array<{ snippet: { title: string; thumbnails: { high?: { url: string }; default?: { url: string } } }; contentDetails: { duration: string } }> }>(
      endpoint,
      { method: 'GET' },
      { circuitKey: 'youtube', timeoutMs: 5000, retries: 1 },
    );

    const item = response.items?.[0];
    if (!item) {
      return null;
    }

    return {
      title: item.snippet.title,
      thumbnailUrl: item.snippet.thumbnails.high?.url ?? item.snippet.thumbnails.default?.url ?? '',
      duration: item.contentDetails.duration,
    };
  }

  private extractVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match?.[1] ?? null;
  }
}
