import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
  Query,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import type { ApiRequest } from '../../../common/interfaces/auth-context.interface';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { parseAdminPage } from '../../../common/pagination/admin-page';
import { idempotencyKeySchema } from '../contracts/billing.schemas';
import {
  BillingCheckoutDto,
  BillingTrialDto,
  BillingEmptyDto,
} from '../contracts/billing.dto';
import { BillingProductService } from '../services/billing-product.service';
export function financialKey(req: ApiRequest) {
  const parsed = idempotencyKeySchema.safeParse(req.header('idempotency-key'));
  if (!parsed.success)
    throw new BadRequestException({
      message: 'Idempotency-Key es obligatorio y debe ser válido.',
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });
  return parsed.data;
}
const idempotency = {
  name: 'Idempotency-Key',
  required: true,
  description: 'Identidad estable del intento; conservarla en reintentos.',
};
@ApiTags('Billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class BillingController {
  constructor(private readonly billing: BillingProductService) {}
  @Get('summary') summary(@Req() req: ApiRequest) {
    return this.billing.repository.summary(req.user!);
  }
  @Get('entitlements') @Roles('admin', 'editor') entitlements(
    @Req() req: ApiRequest,
  ) {
    return this.billing.repository.summary({ ...req.user!, roles: [] });
  }
  @Get('capabilities') @Roles('admin', 'editor') async capabilities(
    @Req() req: ApiRequest,
  ) {
    return {
      platformBillingOperator: (
        await this.billing.repository.summary({ ...req.user!, roles: [] })
      ).isOperator,
    };
  }
  @Get('catalog') catalog() {
    return this.billing.repository.catalog();
  }
  @Get('payments') payments(
    @Req() req: ApiRequest,
    @Query() query: Record<string, unknown>,
  ) {
    const p = parseAdminPage(query);
    return this.billing.repository.payments(
      req.user!.tenantId,
      p.page,
      p.limit,
    );
  }
  @Get('operations/:id') operation(
    @Req() req: ApiRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billing.operation(req.user!, id);
  }
  @Post('trial') @HttpCode(201) @ApiHeader(idempotency) trial(
    @Req() req: ApiRequest,
    @Body() dto: BillingTrialDto,
  ) {
    return this.billing.repository.startTrial(
      req.user!,
      financialKey(req),
      dto.planVersionId,
    );
  }
  @Post('checkouts') @HttpCode(202) @ApiHeader(idempotency) checkout(
    @Req() req: ApiRequest,
    @Body() dto: BillingCheckoutDto,
  ) {
    return this.billing.checkout(req.user!, financialKey(req), dto);
  }
  @Post('subscription/cancel') @HttpCode(202) @ApiHeader(idempotency) cancel(
    @Req() req: ApiRequest,
    @Body() _dto: BillingEmptyDto,
  ) {
    return this.billing.repository.cancel(req.user!, financialKey(req));
  }
  @Post('subscription/changes') @HttpCode(202) @ApiHeader(idempotency) change(
    @Req() req: ApiRequest,
    @Body() dto: BillingCheckoutDto,
  ) {
    return this.billing.repository.change(req.user!, financialKey(req), dto);
  }
  @Post('subscription/changes/cancel')
  @HttpCode(202)
  @ApiHeader(idempotency)
  cancelChange(@Req() req: ApiRequest, @Body() _dto: BillingEmptyDto) {
    return this.billing.repository.cancelChange(req.user!, financialKey(req));
  }
}
