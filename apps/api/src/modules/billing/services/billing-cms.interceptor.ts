import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { from, mergeMap } from 'rxjs';
import type { ApiRequest } from '../../../common/interfaces/auth-context.interface';
import { BillingAccessRepository } from '../repositories/billing-access.repository';
import type { BillingFeature } from '../domain/billing.types';
@Injectable()
export class BillingCmsInterceptor implements NestInterceptor {
  constructor(private readonly access: BillingAccessRepository) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<ApiRequest>();
    const tenantId = req.user?.tenantId ?? req.apiKey?.tenantId;
    const path = req.path.replace(/^\/api\/v1/, '');
    if (
      !this.access.enabled ||
      !tenantId ||
      /^(\/auth|\/billing|\/platform\/billing)(\/|$)/.test(path) ||
      ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    )
      return next.handle();
    const revoke =
      req.method === 'DELETE' && /^\/(api-keys|webhooks)\//.test(path);
    const disableHook =
      req.method === 'PATCH' &&
      /^\/webhooks\/[^/]+\/?$/.test(path) &&
      req.body?.isActive === false &&
      Object.keys(req.body).length === 1;
    if (revoke || disableHook) return next.handle();
    let feature: BillingFeature | undefined;
    if (
      /\/(image|video)\/?$/.test(path) ||
      (path.startsWith('/public/testimonials/') && req.body?.image)
    )
      feature = 'media';
    else if (/^\/(public\/)?analytics/.test(path)) feature = 'analytics';
    else if (path.startsWith('/api-keys')) feature = 'api_keys';
    else if (path.startsWith('/webhooks')) feature = 'webhooks';
    else if (path.startsWith('/bi'))
      feature = path.includes('/statistics')
        ? 'bi_statistics'
        : 'business_intelligence';
    return from(this.access.requireWrite(tenantId, feature)).pipe(
      mergeMap(() => next.handle()),
    );
  }
}
