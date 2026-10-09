import { CanActivate, Injectable } from '@nestjs/common';
import { BiOperationsError } from '../operations.types';

@Injectable()
export class BiOperationsGuard implements CanActivate {
  private readonly enabled = process.env.BI_ENABLED === 'true' && process.env.BI_OPERATIONS_ENABLED === 'true';
  canActivate(): boolean {
    if (!this.enabled) throw new BiOperationsError('BI_OPERATIONS_DISABLED');
    return true;
  }
}
