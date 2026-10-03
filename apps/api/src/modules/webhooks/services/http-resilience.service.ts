import { Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { LoggerService } from './logger.service';
import { WebhookDestinationPolicy } from './webhook-destination-policy';

export interface RetryOptions {
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
  circuitKey: string;
  allowLegacyHttp?: boolean;
  skipCircuit?: boolean;
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

  constructor(private readonly destinationPolicy: WebhookDestinationPolicy) {}

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
          ...(init.body !== undefined && { data: init.body }),
          timeout: timeoutMs,
          maxRedirects: 0,
          proxy: false,
        });

        this.resetCircuit(options.circuitKey);
        return response.data as T;
      } catch (error: unknown) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        // Preserve only a safe status; Axios errors may contain credential-bearing URLs.
        lastError = new Error(status ? `Upstream HTTP ${status}` : 'Upstream network error');
        attempt += 1;

        const retryable = status === undefined || status === 408 || status === 429 || status >= 500;
        if (!retryable || attempt > retries) {
          if (retryable) this.markFailure(options.circuitKey);
          throw lastError;
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
    if (!options.skipCircuit) this.assertCircuit(options.circuitKey);

    const timeoutMs = options.timeoutMs ?? 5000;
    const retries = options.retries ?? 2;
    const baseDelayMs = options.baseDelayMs ?? 250;

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retries) {
      const agent = this.destinationPolicy.createAgent(url, options.allowLegacyHttp);
      try {
        const response = await axios.post(url, body, {
          headers,
          timeout: timeoutMs,
          httpAgent: agent,
          httpsAgent: agent,
          proxy: false,
          maxRedirects: 0,
          maxContentLength: 64 * 1024,
          responseType: 'text',
          // El ledger decide si 2xx, 4xx o 5xx finalizan o reintentan.
          validateStatus: () => true,
        });

        if (!options.skipCircuit) this.resetCircuit(options.circuitKey);

        return {
          status: response.status,
          body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
        };
      } catch (error: unknown) {
        lastError = error;
        attempt += 1;

        if (attempt > retries) {
          if (!options.skipCircuit) this.markFailure(options.circuitKey);
          // H-06: Preservar la causa original del error (RF-24)
          const message = error instanceof AxiosError ? error.message : 'Unexpected delivery error';
          throw new Error(message, { cause: error });
        }

        await this.sleep(this.jitteredBackoff(baseDelayMs, attempt));
      } finally {
        agent.destroy();
      }
    }

    if (!options.skipCircuit) this.markFailure(options.circuitKey);
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
