import { BadRequestException } from '@nestjs/common';

export class ApiKeyHash {
  private constructor(private readonly value: string) {}

  public static create(hash: string): ApiKeyHash {
    const normalized = hash.trim().toLowerCase();
    
    // Hex string of 64 chars = SHA-256
    const regex = /^[a-f0-9]{64}$/;
    if (!regex.test(normalized)) {
      throw new BadRequestException('API key hash must be a valid 64-character SHA-256 hex string');
    }

    return new ApiKeyHash(normalized);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: ApiKeyHash): boolean {
    return this.value === other.getValue();
  }
}
