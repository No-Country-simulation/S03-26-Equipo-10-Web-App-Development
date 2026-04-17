import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

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
        const response = await axios({
          url,
          method: (init.method as string) ?? 'GET',
          headers: init.headers as Record<string, string>,
          data: init.body,
          timeout: timeoutMs,
        });

        this.resetCircuit(options.circuitKey);
        return response.data as T;
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
        const response = await axios.post(url, body, {
          headers,
          timeout: timeoutMs,
          // Accept any status code < 500, let the caller decide what's success
          validateStatus: (status) => status < 500,
        });

        this.resetCircuit(options.circuitKey);

        return {
          status: response.status,
          body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
        };
      } catch (error) {
        lastError = error;
        attempt += 1;

        if (attempt > retries) {
          this.markFailure(options.circuitKey);
          const axiosErr = error as AxiosError;
          throw new Error(axiosErr.message ?? 'Unexpected delivery error');
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
