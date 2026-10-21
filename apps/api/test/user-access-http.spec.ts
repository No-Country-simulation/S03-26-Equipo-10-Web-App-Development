import { Test } from '@nestjs/testing';
import {
  Controller,
  Get,
  UseGuards,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { UsersController } from '../src/modules/users/controllers/users.controller';
import { UsersService } from '../src/modules/users/services/users.service';
import { UserRepository } from '../src/modules/users/repositories/user.repository';
import { PrismaService } from '../src/modules/database/prisma.service';
import { CredentialRepository } from '../src/common/repositories/credential.repository';
import { PasswordService } from '../src/modules/shared/hashing';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';

@Controller('session-probe')
@UseGuards(JwtAuthGuard)
class ProbeController {
  @Get() get() {
    return { allowed: true };
  }
}

// Real controller/service/repository/credentials/JWT pipeline; Prisma is an in-memory substitute.
describe('user activation through HTTP', () => {
  let app: INestApplication;
  const tenant = '00000000-0000-4000-8000-000000000001',
    otherTenant = '00000000-0000-4000-8000-000000000002';
  const editorId = '00000000-0000-4000-8000-000000000003';
  const key = randomBytes(32).toString('hex');
  const makeUser = (id: string, tenantId: string, role: string) => ({
    id,
    tenantId,
    email: `${role}@example.invalid`,
    isActive: true,
    tenant: { name: 'Espacio sintético', isActive: true },
    roles: [{ role: { code: role } }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const editor = makeUser(editorId, tenant, 'editor');
  const admin = makeUser('admin', tenant, 'admin');
  const foreign = makeUser('foreign', otherTenant, 'admin');
  const rows = [editor, admin, foreign];
  const delegate = {
    findUnique: jest.fn(
      async ({ where }: { where: { id: string } }) =>
        rows.find((row) => row.id === where.id) ?? null,
    ),
    findFirst: jest.fn(
      async ({ where }: { where: { id: string; tenantId: string } }) =>
        rows.find(
          (row) => row.id === where.id && row.tenantId === where.tenantId,
        ) ?? null,
    ),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string; tenantId: string };
        data: { isActive?: boolean };
      }) => {
        const row = rows.find(
          (row) => row.id === where.id && row.tenantId === where.tenantId,
        );
        if (!row) throw new Error('Missing test row');
        if (data.isActive !== undefined) row.isActive = data.isActive;
        return row;
      },
    ),
  };
  let adminToken: string, editorToken: string, foreignToken: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController, ProbeController],
      providers: [
        UsersService,
        UserRepository,
        CredentialRepository,
        JwtService,
        {
          provide: PrismaService,
          useValue: {
            user: delegate,
            $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
              work({ user: delegate, $executeRaw: jest.fn() }),
          },
        },
        { provide: PasswordService, useValue: { hashPassword: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => ({ jwt: { secret: key } }) },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const jwt = app.get(JwtService);
    adminToken = jwt.sign({ sub: admin.id, tenantId: tenant }, { secret: key });
    editorToken = jwt.sign(
      { sub: editor.id, tenantId: tenant },
      { secret: key },
    );
    foreignToken = jwt.sign(
      { sub: foreign.id, tenantId: otherTenant },
      { secret: key },
    );
  });
  beforeEach(() => {
    editor.isActive = true;
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('rejects an already-issued token while disabled and permits it after reactivation', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/session-probe')
      .auth(editorToken, { type: 'bearer' })
      .expect(200);
    const disabled = await request(app.getHttpServer())
      .patch(`/api/v1/users/${editorId}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ isActive: false })
      .expect(200);
    expect(disabled.body.data).toMatchObject({
      id: editorId,
      isActive: false,
      roles: ['editor'],
    });
    await request(app.getHttpServer())
      .get('/api/v1/session-probe')
      .auth(editorToken, { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${editorId}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ isActive: true })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/session-probe')
      .auth(editorToken, { type: 'bearer' })
      .expect(200);
    expect(delegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: editorId, tenantId: tenant },
        data: { isActive: false },
      }),
    );
  });
  it('rejects editor mutations, foreign targets and invalid activation payloads without changing access', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${editorId}`)
      .auth(editorToken, { type: 'bearer' })
      .send({ isActive: false })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${editorId}`)
      .auth(foreignToken, { type: 'bearer' })
      .send({ isActive: false })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${editorId}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ isActive: 'false' })
      .expect(400);
    expect(editor.isActive).toBe(true);
    expect(delegate.update).not.toHaveBeenCalled();
  });
});
