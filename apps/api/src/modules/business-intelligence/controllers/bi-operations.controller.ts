import { Body, Controller, createParamDecorator, ExecutionContext, Get, HttpCode, Injectable, Param, ParseUUIDPipe, Patch, PipeTransform,
  Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { InvalidInputError } from '../../../common/errors/application.error';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import type { ApiRequest, AuthenticatedUser } from '../../../common/interfaces/auth-context.interface';
import { EmptyOperationsDto, LoadRequestDto, OperationsQueryDto, RequestsQueryDto, RunsQueryDto, SettingsPatchDto } from '../dtos/operations.dto';
import { BiOperationsGuard } from '../guards/bi-operations.guard';
import { idempotencyKeySchema } from '../operations.types';
import { OperationsService } from '../services/operations.service';

@Injectable()
export class BiIdempotencyKeyPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const result = idempotencyKeySchema.safeParse(value);
    if (!result.success) throw new InvalidInputError('Idempotency-Key is required: 1–128 ASCII letters, digits, dots, underscores, colons or hyphens');
    return result.data;
  }
}
const RequiredBiKey = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  context.switchToHttp().getRequest<ApiRequest>().header('idempotency-key'));
const keyHeader = { name: 'Idempotency-Key', required: true,
  description: 'Durable per tenant and actor; reuse only with the same content. Stored in the warehouse, without the OLTP 24-hour expiry.' };

@ApiTags('Business intelligence operations')
@ApiBearerAuth()
@Controller('bi')
@UseGuards(JwtAuthGuard, RolesGuard, BiOperationsGuard, RateLimitGuard)
@Roles('admin', 'editor')
@RateLimit({ limit: 120, windowSeconds: 60 })
export class BiOperationsController {
  constructor(private readonly operations: OperationsService) {}
  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser, @Query() _query: EmptyOperationsDto) { return this.operations.status(user); }
  @Get('settings')
  settings(@CurrentTenantId() tenantId: string, @Query() _query: EmptyOperationsDto) { return this.operations.settings(tenantId); }
  @Patch('settings')
  @Roles('admin')
  @RateLimit({ limit: 20, windowSeconds: 60 })
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() input: SettingsPatchDto, @Query() _query: EmptyOperationsDto) {
    return this.operations.updateSettings(user, input);
  }
  @Get('runs')
  runs(@CurrentTenantId() tenantId: string, @Query() query: RunsQueryDto) { return this.operations.runs(tenantId, query); }
  @Get('runs/:id')
  run(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Query() _query: EmptyOperationsDto) {
    return this.operations.run(user, id);
  }
  @Get('requests')
  requests(@CurrentTenantId() tenantId: string, @Query() query: RequestsQueryDto) { return this.operations.requests(tenantId, query); }
  @Get('requests/:id')
  request(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Query() _query: EmptyOperationsDto) {
    return this.operations.request(user, id);
  }
  @Post('requests')
  @HttpCode(202)
  @Roles('admin')
  @ApiHeader(keyHeader)
  @RateLimit({ limit: 6, windowSeconds: 60 })
  createRequest(@CurrentUser() user: AuthenticatedUser, @RequiredBiKey(BiIdempotencyKeyPipe) key: string,
    @Body() input: LoadRequestDto, @Query() _query: EmptyOperationsDto) { return this.operations.createRequest(user, key, input); }
  @Post('requests/:id/cancel')
  @HttpCode(200)
  @Roles('admin')
  @ApiHeader(keyHeader)
  @RateLimit({ limit: 20, windowSeconds: 60 })
  cancelRequest(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string,
    @RequiredBiKey(BiIdempotencyKeyPipe) key: string, @Body() _input: EmptyOperationsDto, @Query() _query: EmptyOperationsDto) {
    return this.operations.cancelRequest(user, id, key);
  }
  @Get('audit')
  @Roles('admin')
  audit(@CurrentTenantId() tenantId: string, @Query() query: OperationsQueryDto) { return this.operations.audit(tenantId, query); }
}
