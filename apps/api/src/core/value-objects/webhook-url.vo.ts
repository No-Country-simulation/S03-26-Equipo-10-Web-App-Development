import { BadRequestException } from '@nestjs/common';

export class WebhookUrl {
  private constructor(private readonly value: string) {}

  public static create(url: string): WebhookUrl {
    const normalized = url.trim();
    
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new BadRequestException('Webhook URL must use http or https protocol');
      }
      
      return new WebhookUrl(normalized);
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(`Invalid Webhook URL format: ${url}`);
    }
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: WebhookUrl): boolean {
    return this.value === other.getValue();
  }
}
