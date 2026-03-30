import { BadRequestException } from '@nestjs/common';

export class Email {
  private constructor(private readonly value: string) {}

  public static create(email: string): Email {
    const normalized = email.trim().toLowerCase();
    
    // Simple fast regex for basic email validation
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(normalized)) {
      throw new BadRequestException(`Invalid email format: ${email}`);
    }

    return new Email(normalized);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: Email): boolean {
    return this.value === other.getValue();
  }
}
