

export class Webhook {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private url: string,
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
    return new Webhook(
      id,
      tenantId,
      rawUrl,
      eventCode,
      secret,
      isActive,
      new Date(),
    );
  }

  public updateUrl(rawUrl: string): void {
    this.url = rawUrl;
  }

  public getUrl(): string {
    return this.url;
  }

  public toggleActive(isActive: boolean): void {
    this.isActive = isActive;
  }
}
