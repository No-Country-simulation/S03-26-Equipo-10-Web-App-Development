import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { InvalidInputError } from '../../../common/errors/application.error';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return value >= '0001-01-01' && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid UTC calendar date');
export class DashboardQueryDto extends createZodDto(z.object({ from: day.optional(), to: day.optional() }).strict()) {}
export interface DateRange { from: string; to: string; timezone: 'UTC' }
export function dateRange(query: DashboardQueryDto, now = new Date()): DateRange {
  const today = now.toISOString().slice(0, 10);
  const to = query.to ?? today;
  const from = query.from ?? new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  if (!Number.isFinite(days) || days < 1 || days > 366 || to > today || from < '0001-01-01') {
    throw new InvalidInputError('Date range must contain 1–366 UTC days and cannot end in the future');
  }
  return { from, to, timezone: 'UTC' };
}
