import { Injectable, HttpException } from '@nestjs/common';

interface AttemptState {
  count: number;
  blockedUntil?: number;
}

@Injectable()
export class LoginAttemptsService {
  private readonly attempts = new Map<string, AttemptState>();
  private readonly maxAttempts = 5;
  private readonly blockWindowMs = 15 * 60 * 1000;

  assertNotBlocked(email: string) {
    const state = this.attempts.get(email.toLowerCase());
    if (state?.blockedUntil && state.blockedUntil > Date.now()) {
      throw new HttpException('Account temporarily locked', 429);
    }
  }

  registerFailure(email: string) {
    const key = email.toLowerCase();
    const current = this.attempts.get(key) ?? { count: 0 };
    const nextCount = current.count + 1;
    const blockedUntil =
      nextCount >= this.maxAttempts ? Date.now() + this.blockWindowMs : undefined;

    this.attempts.set(key, {
      count: blockedUntil ? 0 : nextCount,
      blockedUntil,
    });
  }

  clear(email: string) {
    this.attempts.delete(email.toLowerCase());
  }
}
