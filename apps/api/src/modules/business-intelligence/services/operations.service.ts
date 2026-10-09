import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../common/interfaces/auth-context.interface';
import { dateRange } from '../dtos/dashboard-query.dto';
import type { OperationsQueryDto, RequestsQueryDto, RunsQueryDto } from '../dtos/operations.dto';
import type { LoadRequestInput, SettingsPatch } from '../operations.types';
import { BiControlConnection } from '../repositories/bi-control-connection';
import { OperationsControlRepository } from '../repositories/operations-control.repository';
import { OperationsReadRepository } from '../repositories/operations-read.repository';
import { operationsStatus, presentRequest, presentRun } from './operations-policy';

function filter(query: OperationsQueryDto) { return { ...dateRange(query), page: query.page, limit: query.limit }; }
@Injectable()
export class OperationsService {
  constructor(private readonly reads: OperationsReadRepository, private readonly control: OperationsControlRepository,
    private readonly connection: BiControlConnection) {}
  async status(user: AuthenticatedUser) {
    return operationsStatus(await this.reads.state(user.tenantId), user.roles.includes('admin'), this.connection.configured);
  }
  settings(tenantId: string) { return this.reads.settings(tenantId); }
  async runs(tenantId: string, query: RunsQueryDto) {
    const page = await this.reads.runs(tenantId, { ...filter(query),
      ...(query.status ? { status: query.status } : {}), ...(query.origin ? { origin: query.origin } : {}) });
    return { ...page, items: page.items.map(presentRun) };
  }
  async run(user: AuthenticatedUser, id: string) {
    const run = await this.reads.run(user.tenantId, id);
    const status = await this.status(user);
    return { ...presentRun(run), actions: { retry: ['failed', 'abandoned'].includes(run.status)
      ? { ...status.actions.runNow, runId: run.id }
      : { allowed: false, reason: 'BI_RETRY_NOT_ALLOWED', message: 'Sólo se puede reintentar una ejecución fallida o abandonada.', runId: run.id } } };
  }
  async requests(tenantId: string, query: RequestsQueryDto) {
    const page = await this.reads.requests(tenantId, { ...filter(query), ...(query.status ? { status: query.status } : {}) });
    return { ...page, items: page.items.map(presentRequest) };
  }
  async request(user: AuthenticatedUser, id: string) {
    const result = await this.reads.request(user.tenantId, id);
    const status = await this.status(user);
    const cancel = status.actions.cancel.requestId === result.request.id ? status.actions.cancel
      : { allowed: false, reason: 'BI_REQUEST_NOT_PENDING', message: 'La solicitud ya no está pendiente.', requestId: id };
    return { request: presentRequest(result.request), runs: result.runs.map(presentRun), actions: { cancel } };
  }
  audit(tenantId: string, query: OperationsQueryDto) { return this.reads.audit(tenantId, filter(query)); }
  updateSettings(user: AuthenticatedUser, input: SettingsPatch) {
    return this.control.updateSettings({ tenantId: user.tenantId, actorId: user.userId }, input);
  }
  async createRequest(user: AuthenticatedUser, key: string, input: LoadRequestInput) {
    const result = await this.control.createRequest({ tenantId: user.tenantId, actorId: user.userId }, key, input, true);
    // A stable receipt, including on replay after completion; GET returns the durable lifecycle.
    return { id: result.request.id, status: 'accepted' as const };
  }
  async cancelRequest(user: AuthenticatedUser, id: string, key: string) {
    return presentRequest(await this.control.cancelRequest({ tenantId: user.tenantId, actorId: user.userId }, id, key));
  }
}
