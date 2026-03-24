import { Injectable, Logger } from '@nestjs/common';

export interface RetryOptions {
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
  circuitKey: string;
}

interface CircuitState {
  failures: number;
  openedAt?: number;
}

@Injectable()
export class HttpResilienceService {
  private readonly logger = new Logger(HttpResilienceService.name);
  private readonly circuits = new Map<string, CircuitState>();

  async request<T>(
    url: string,
    init: RequestInit,
    options: RetryOptions,
  ): Promise<T> {
    this.assertCircuit(options.circuitKey);

    const timeoutMs = options.timeoutMs ?? 5000;
    const retries = options.retries ?? 2;
    const baseDelayMs = options.baseDelayMs ?? 250;

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retries) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        this.resetCircuit(options.circuitKey);
        return (await response.json()) as T;
      } catch (error) {
        lastError = error;
        attempt += 1;

        if (attempt > retries) {
          this.markFailure(options.circuitKey);
          throw error;
        }

        await this.sleep(baseDelayMs * attempt + Math.floor(Math.random() * 100));
      }
    }

    this.markFailure(options.circuitKey);
    throw lastError;
  }

  async postText(
    url: string,
    body: string,
    headers: Record<string, string>,
    options: RetryOptions,
  ): Promise<{ status: number; body: string }> {
    this.assertCircuit(options.circuitKey);

    const timeoutMs = options.timeoutMs ?? 5000;
    const retries = options.retries ?? 2;
    const baseDelayMs = options.baseDelayMs ?? 250;

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retries) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
          method: 'POST',
          body,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timer);
        const responseText = await response.text();

        if (response.status >= 500) {
          throw new Error(`HTTP ${response.status}`);
        }

        this.resetCircuit(options.circuitKey);

        return {
          status: response.status,
          body: responseText,
        };
      } catch (error) {
        lastError = error;
        attempt += 1;

        if (attempt > retries) {
          this.markFailure(options.circuitKey);
          throw error;
        }

        await this.sleep(baseDelayMs * attempt + Math.floor(Math.random() * 100));
      }
    }

    this.markFailure(options.circuitKey);
    throw lastError;
  }

  private assertCircuit(key: string) {
    const state = this.circuits.get(key);
    if (!state?.openedAt) {
      return;
    }

    const elapsed = Date.now() - state.openedAt;
    const resetMs = 30_000;
    if (elapsed > resetMs) {
      this.circuits.set(key, { failures: 0 });
      return;
    }

    throw new Error(`Circuit open for ${key}`);
  }

  private markFailure(key: string) {
    const current = this.circuits.get(key) ?? { failures: 0 };
    const failures = current.failures + 1;

    if (failures >= 3) {
      this.logger.warn(`Circuit opened for ${key}`);
      this.circuits.set(key, { failures, openedAt: Date.now() });
      return;
    }

    this.circuits.set(key, { failures });
  }

  private resetCircuit(key: string) {
    this.circuits.set(key, { failures: 0 });
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}
