import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

interface IdempotencyLookupInput {
  key: string;
  tenantId: string;
  method: string;
  path: string;
}

interface IdempotencySaveInput extends IdempotencyLookupInput {
  statusCode: number;
  body: unknown;
}

export interface IdempotentResponse {
  statusCode: number;
  body: unknown;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async get(input: IdempotencyLookupInput): Promise<IdempotentResponse | null> {
    const record = await this.prisma.idempotencyKey.findUnique({
      where: {
        key_tenantId_method_path: {
          key: input.key,
          tenantId: input.tenantId,
          method: input.method,
          path: input.path,
        },
      },
    });

    if (!record) {
      return null;
    }

    return {
      statusCode: record.statusCode,
      body: record.responseBody as unknown,
    };
  }

  async save(input: IdempotencySaveInput): Promise<void> {
    await this.prisma.idempotencyKey.upsert({
      where: {
        key_tenantId_method_path: {
          key: input.key,
          tenantId: input.tenantId,
          method: input.method,
          path: input.path,
        },
      },
      create: {
        key: input.key,
        tenantId: input.tenantId,
        method: input.method,
        path: input.path,
        statusCode: input.statusCode,
        responseBody: input.body as Prisma.InputJsonValue,
      },
      update: {
        statusCode: input.statusCode,
        responseBody: input.body as Prisma.InputJsonValue,
      },
    });
  }
}
