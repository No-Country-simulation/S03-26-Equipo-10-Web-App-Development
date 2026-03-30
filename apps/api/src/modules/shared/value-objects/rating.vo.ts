import { BadRequestException } from '@nestjs/common';

export class Rating {
  private constructor(private readonly value: number) {}

  public static create(rating: number): Rating {
    const integerRating = Math.round(rating);
    
    if (integerRating < 1 || integerRating > 5) {
      throw new BadRequestException(`Rating must be between 1 and 5, received: ${rating}`);
    }

    return new Rating(integerRating);
  }

  public getValue(): number {
    return this.value;
  }

  public equals(other: Rating): boolean {
    return this.value === other.getValue();
  }
}
