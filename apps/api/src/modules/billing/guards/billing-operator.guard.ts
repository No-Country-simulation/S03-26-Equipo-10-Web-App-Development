import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Inject,
  Optional,
} from '@nestjs/common';
import {
  BILLING_CONFIG,
  type BillingConfig,
} from '../integrations/billing.config';
import { ApplicationError } from '../../../common/errors/application.error';
import type { ApiRequest } from '../../../common/interfaces/auth-context.interface';
import { BillingOperatorRepository } from '../repositories/billing-operator.repository';

@Injectable()
export class BillingOperatorGuard implements CanActivate {
  constructor(
    private readonly operators: BillingOperatorRepository,
    @Optional() @Inject(BILLING_CONFIG) private readonly config?: BillingConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.config?.mode === 'disabled')
      throw new ApplicationError(
        'La facturación está desactivada.',
        'unavailable',
        'BILLING_DISABLED',
      );
    const userId = context.switchToHttp().getRequest<ApiRequest>().user?.userId;
    if (!userId || !(await this.operators.isOperator(userId)))
      throw new ForbiddenException({
        message: 'Billing operator required',
        code: 'BILLING_OPERATOR_REQUIRED',
      });
    return true;
  }
}
