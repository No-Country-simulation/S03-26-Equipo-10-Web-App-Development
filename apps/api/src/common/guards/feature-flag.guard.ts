import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_FEATURE_KEY } from '../decorators/feature-flag.decorator';
import { IFeatureFlagEvaluator } from '../interfaces/feature-flag-evaluator.interface';
import type { ApiRequest } from '../interfaces/auth-context.interface';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagEvaluator: IFeatureFlagEvaluator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ApiRequest>();
    const tenantId = request.user?.tenantId ?? request.apiKey?.tenantId;
    
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required for feature flag evaluation');
    }

    const isEnabled = await this.featureFlagEvaluator.isEnabled(tenantId, requiredFeature);

    if (!isEnabled) {
      throw new ForbiddenException(`Feature '${requiredFeature}' is disabled for this tenant`);
    }

    return true;
  }
}
