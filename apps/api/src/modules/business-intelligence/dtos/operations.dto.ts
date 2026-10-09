import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DashboardQueryDto } from './dashboard-query.dto';
import { loadRequestInputSchema, settingsPatchSchema } from '../operations.types';

const pagination = {
  page: z.string().regex(/^[1-9]\d{0,4}$/).transform(Number).pipe(z.number().max(10000)).default(1),
  limit: z.string().regex(/^[1-9]\d{0,2}$/).transform(Number).pipe(z.number().max(100)).default(20),
};
const history = DashboardQueryDto.schema.extend(pagination);
export class OperationsQueryDto extends createZodDto(history) {}
export class RunsQueryDto extends createZodDto(history.extend({
  status: z.enum(['running', 'succeeded', 'failed', 'abandoned']).optional(),
  origin: z.enum(['legacy', 'scheduled', 'cli', 'manual', 'retry']).optional(),
})) {}
export class RequestsQueryDto extends createZodDto(history.extend({
  status: z.enum(['pending', 'running', 'succeeded', 'failed', 'cancelled', 'expired', 'skipped']).optional(),
})) {}
export class SettingsPatchDto extends createZodDto(settingsPatchSchema) {}
export class LoadRequestDto extends createZodDto(loadRequestInputSchema) {}
export class EmptyOperationsDto extends createZodDto(z.object({}).strict().default({})) {}
