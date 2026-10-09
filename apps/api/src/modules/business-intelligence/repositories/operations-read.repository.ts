import { Prisma } from '@prisma/client';
import { ApplicationError, InvalidInputError, NotFoundError } from '../../../common/errors/application.error';
import { DashboardQueryDto, dateRange } from '../dtos/dashboard-query.dto';
import { operationIdentitySchema, type BiRun, type ControlAudit, type OperationsFilter, type OperationsPage,
  type RequestFilter, type RunFilter } from '../operations.types';
import { databaseTime, findRequest, readSettings, requestProjection, requestRecord, runProjection, runRecord,
  type RequestRow, type RunRow } from './operations-records';

export interface OperationsReads { read<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> }
function validateFilter(filter: OperationsFilter) {
  dateRange(DashboardQueryDto.schema.parse({ from: filter.from, to: filter.to }));
  if (!Number.isInteger(filter.page) || filter.page < 1 || filter.page > 10000 || !Number.isInteger(filter.limit) || filter.limit < 1 || filter.limit > 100) {
    throw new InvalidInputError('Invalid BI pagination');
  }
}
function totalCount(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new ApplicationError('BI count exceeds transport limit', 'internal');
  return Number(value);
}

export class OperationsReadRepository {
  constructor(private readonly connection: OperationsReads) {}
  settings(tenantId: string) {
    operationIdentitySchema.shape.tenantId.parse(tenantId);
    return this.connection.read(async tx => readSettings(tx, tenantId, await databaseTime(tx)));
  }
  runs(tenantId: string, filter: RunFilter): Promise<OperationsPage<BiRun>> {
    validateFilter(filter);
    const where = Prisma.sql`tenant_id = ${tenantId}::uuid AND started_at >= ${filter.from}::date
      AND started_at < ${filter.to}::date + interval '1 day'
      ${filter.status ? Prisma.sql`AND status = ${filter.status}` : Prisma.empty}
      ${filter.origin ? Prisma.sql`AND origin = ${filter.origin}` : Prisma.empty}`;
    return this.connection.read(async tx => {
      const [count] = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT count(*) AS count FROM etl.runs WHERE ${where}`);
      const rows = await tx.$queryRaw<RunRow[]>(Prisma.sql`SELECT ${runProjection} FROM etl.runs WHERE ${where}
        ORDER BY started_at DESC, id DESC LIMIT ${filter.limit} OFFSET ${(filter.page - 1) * filter.limit}`);
      return { items: rows.map(runRecord), meta: { total: totalCount(count?.count ?? 0n), page: filter.page, limit: filter.limit } };
    });
  }
  run(tenantId: string, id: string) {
    return this.connection.read(async tx => {
      const [row] = await tx.$queryRaw<RunRow[]>(Prisma.sql`SELECT ${runProjection} FROM etl.runs
        WHERE tenant_id = ${tenantId}::uuid AND id = ${id}::uuid`);
      if (!row) throw new NotFoundError('BI run not found');
      return runRecord(row);
    });
  }
  requests(tenantId: string, filter: RequestFilter) {
    validateFilter(filter);
    const where = Prisma.sql`tenant_id = ${tenantId}::uuid AND created_at >= ${filter.from}::date
      AND created_at < ${filter.to}::date + interval '1 day' ${filter.status ? Prisma.sql`AND status = ${filter.status}` : Prisma.empty}`;
    return this.connection.read(async tx => {
      const [count] = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT count(*) AS count FROM etl.load_requests WHERE ${where}`);
      const rows = await tx.$queryRaw<RequestRow[]>(Prisma.sql`SELECT ${requestProjection} FROM etl.load_requests WHERE ${where}
        ORDER BY created_at DESC, id DESC LIMIT ${filter.limit} OFFSET ${(filter.page - 1) * filter.limit}`);
      return { items: rows.map(requestRecord), meta: { total: totalCount(count?.count ?? 0n), page: filter.page, limit: filter.limit } };
    });
  }
  request(tenantId: string, id: string) {
    return this.connection.read(async tx => {
      const request = await findRequest(tx, tenantId, id);
      if (!request) throw new NotFoundError('BI request not found');
      const rows = await tx.$queryRaw<RunRow[]>(Prisma.sql`SELECT ${runProjection} FROM etl.runs
        WHERE tenant_id = ${tenantId}::uuid AND request_id = ${id}::uuid ORDER BY attempt_no, id`);
      return { request, runs: rows.map(runRecord) };
    });
  }
  audit(tenantId: string, filter: OperationsFilter): Promise<OperationsPage<ControlAudit>> {
    validateFilter(filter);
    const where = Prisma.sql`tenant_id = ${tenantId}::uuid AND created_at >= ${filter.from}::date AND created_at < ${filter.to}::date + interval '1 day'`;
    return this.connection.read(async tx => {
      const [count] = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT count(*) AS count FROM etl.control_audit WHERE ${where}`);
      const rows = await tx.$queryRaw<Array<Omit<ControlAudit, 'createdAt'> & { createdAt: Date }>>(Prisma.sql`
        SELECT id, actor_id AS "actorId", action, request_id AS "requestId", settings_before AS "settingsBefore",
          settings_after AS "settingsAfter", created_at AS "createdAt" FROM etl.control_audit WHERE ${where}
        ORDER BY created_at DESC, id DESC LIMIT ${filter.limit} OFFSET ${(filter.page - 1) * filter.limit}`);
      return { items: rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })),
        meta: { total: totalCount(count?.count ?? 0n), page: filter.page, limit: filter.limit } };
    });
  }
}
