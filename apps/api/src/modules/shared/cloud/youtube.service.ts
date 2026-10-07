import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpResilienceService } from '../../webhooks';
import type { AppConfig } from '../../../config/app.config';
import { parseYoutubeUrl } from './parse-youtube-url';

interface YouTubeMetadata {
  title: string;
  thumbnailUrl: string;
  duration: string;
}

@Injectable()
export class YoutubeService {
  private readonly youtubeApiKey: string;

  constructor(
    private readonly http: HttpResilienceService,
    private readonly configService: ConfigService,
  ) {
    this.youtubeApiKey = this.configService.get<AppConfig>('app')!.youtube.apiKey;
  }

  async getVideoMetadata(url: string): Promise<YouTubeMetadata | null> {
    const { videoId } = parseYoutubeUrl(url);
    if (!this.youtubeApiKey) {
      return null;
    }

    const endpoint = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails`;

    const response = await this.http.request<{ items: Array<{ snippet: { title: string; thumbnails: { high?: { url: string }; default?: { url: string } } }; contentDetails: { duration: string } }> }>(
      endpoint,
      { method: 'GET', headers: { 'X-Goog-Api-Key': this.youtubeApiKey } },
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

}
