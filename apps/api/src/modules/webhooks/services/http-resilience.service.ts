import { Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { LoggerService } from './logger.service';

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

/** Tiempo en ms que el circuito permanece abierto antes de reintentar. */
const CIRCUIT_RESET_MS = 30_000;
/** Número de fallos consecutivos para abrir el circuito. */
const CIRCUIT_THRESHOLD = 3;

@Injectable()
export class HttpResilienceService {
  private readonly logger = new LoggerService();
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
      } catch (error: unknown) {
        lastError = error;
        attempt += 1;

        if (attempt > retries) {
          this.markFailure(options.circuitKey);
          throw error;
        }

        await this.sleep(this.jitteredBackoff(baseDelayMs, attempt));
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
          // Acepta cualquier status < 500 — el caller decide qué es éxito
          validateStatus: (status) => status < 500,
        });

        this.resetCircuit(options.circuitKey);

        return {
          status: response.status,
          body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
        };
      } catch (error: unknown) {
        lastError = error;
        attempt += 1;

        if (attempt > retries) {
          this.markFailure(options.circuitKey);
          // H-06: Preservar la causa original del error (RF-24)
          const message = error instanceof AxiosError ? error.message : 'Unexpected delivery error';
          throw new Error(message, { cause: error });
        }

        await this.sleep(this.jitteredBackoff(baseDelayMs, attempt));
      }
    }

    this.markFailure(options.circuitKey);
    throw lastError;
  }

  private assertCircuit(key: string) {
    const state = this.circuits.get(key);
    if (!state?.openedAt) return;

    const elapsed = Date.now() - state.openedAt;
    if (elapsed > CIRCUIT_RESET_MS) {
      this.circuits.set(key, { failures: 0 });
      return;
    }

    throw new Error(`Circuit open for ${key}`);
  }

  private markFailure(key: string) {
    const current = this.circuits.get(key) ?? { failures: 0 };
    const failures = current.failures + 1;

    if (failures >= CIRCUIT_THRESHOLD) {
      this.logger.warn(`Circuit opened for ${key}`, { circuitKey: key, failures });
      this.circuits.set(key, { failures, openedAt: Date.now() });
      return;
    }

    this.circuits.set(key, { failures });
  }

  private resetCircuit(key: string) {
    this.circuits.set(key, { failures: 0 });
  }

  /** Backoff exponencial con jitter completo para evitar thundering herd. */
  private jitteredBackoff(baseDelayMs: number, attempt: number): number {
    return baseDelayMs * attempt + Math.floor(Math.random() * 100);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, ms));
  }
}
