import { Email } from '../../shared/value-objects/email.vo';

export class User {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private email: Email,
    private passwordHash: string | null,
    private roles: string[],
    private isActive: boolean,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  public static create(
    id: string,
    tenantId: string,
    rawEmail: string,
    passwordHash: string | null,
    roles: string[] = ['editor'],
    isActive = true,
  ): User {
    const emailVO = Email.create(rawEmail);
    return new User(
      id,
      tenantId,
      emailVO,
      passwordHash,
      roles,
      isActive,
      new Date(),
      new Date(),
    );
  }

  public updateEmail(rawEmail: string): void {
    this.email = Email.create(rawEmail);
    this.markUpdated();
  }

  public updatePassword(passwordHash: string): void {
    this.passwordHash = passwordHash;
    this.markUpdated();
  }

  public deactivate(): void {
    this.isActive = false;
    this.markUpdated();
  }

  public assignRole(role: string): void {
    if (!this.roles.includes(role)) {
      this.roles.push(role);
      this.markUpdated();
    }
  }

  private markUpdated(): void {
    this.updatedAt = new Date();
  }

  public getEmail(): string {
    return this.email.getValue();
  }
}
