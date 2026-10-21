import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { ApiRequest } from '../../../common/interfaces/auth-context.interface';
import { BillingOperatorRepository } from '../repositories/billing-operator.repository';

@Injectable()
export class BillingOperatorGuard implements CanActivate {
  constructor(private readonly operators: BillingOperatorRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userId = context.switchToHttp().getRequest<ApiRequest>().user?.userId;
    if (!userId || !(await this.operators.isOperator(userId)))
      throw new ForbiddenException({
        message: 'Billing operator required',
        code: 'BILLING_OPERATOR_REQUIRED',
      });
    return true;
  }
}
