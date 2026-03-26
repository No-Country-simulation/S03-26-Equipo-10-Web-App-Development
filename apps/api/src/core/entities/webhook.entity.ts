import { WebhookUrl } from '../value-objects/webhook-url.vo';

export class Webhook {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private url: WebhookUrl,
    private eventCode: string,
    private secret: string | null,
    private isActive: boolean,
    private readonly createdAt: Date,
  ) {}

  public static create(
    id: string,
    tenantId: string,
    rawUrl: string,
    eventCode: string,
    secret: string | null,
    isActive = true,
  ): Webhook {
    const urlVO = WebhookUrl.create(rawUrl);
    return new Webhook(
      id,
      tenantId,
      urlVO,
      eventCode,
      secret,
      isActive,
      new Date(),
    );
  }

  public updateUrl(rawUrl: string): void {
    this.url = WebhookUrl.create(rawUrl);
  }

  public getUrl(): string {
    return this.url.getValue();
  }

  public toggleActive(isActive: boolean): void {
    this.isActive = isActive;
  }
}
