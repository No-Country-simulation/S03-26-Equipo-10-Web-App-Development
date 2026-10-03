import { InvalidInputError } from '../errors/application.error';

export interface AdminPage {
  page: number;
  limit: number;
}

export function parseAdminPage(query: Record<string, unknown>): AdminPage {
  function read(value: unknown, fallback: number, maximum: number): number {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
      throw new InvalidInputError('Pagination values must be positive integers');
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed > maximum) {
      throw new InvalidInputError('Pagination value is out of range');
    }
    return parsed;
  }
  return { page: read(query.page, 1, 10_000), limit: read(query.limit, 20, 100) };
}

export function pageOffset(page: AdminPage): number {
  return (page.page - 1) * page.limit;
}
