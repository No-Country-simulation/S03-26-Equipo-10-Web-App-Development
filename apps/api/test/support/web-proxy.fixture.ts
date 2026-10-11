/** Local transport fixture only: no database, Redis or external services.
 * AuthController, CSRF and JWT guards are real; credentials/session storage are
 * deliberately in memory. This does not validate AuthService persistence.
 */
import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { APP_GUARD } from '@nestjs/core';
import { All, Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import { boundedJsonBody } from '../../src/common/middleware/body-limits.middleware';
import type { Request, Response } from 'express';
import { AuthController } from '../../src/modules/auth/controllers/auth.controller';
import { AuthService } from '../../src/modules/auth/services/auth.service';
import { CsrfGuard } from '../../src/common/guards/csrf.guard';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../src/common/guards/rate-limit.guard';
import { SessionCsrfService } from '../../src/common/services/session-csrf.service';
import { CredentialRepository } from '../../src/common/repositories/credential.repository';
import { privateApiCache } from '../../src/common/middleware/private-cache.middleware';
import { ApiResponseInterceptor } from '../../src/common/interceptors/api-response.interceptor';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import type { ApiRequest, AuthenticatedUser } from '../../src/common/interfaces/auth-context.interface';

const jwt = new JwtService({ secret: 'test-only-proxy-fixture-at-least-32-characters' });
const users = new Map<string, AuthenticatedUser>();
const sessions = new Map<string, { sid: string; user: AuthenticatedUser }>();
function issue(user: AuthenticatedUser) {
  const sid = randomUUID();
  const refreshToken = randomUUID();
  sessions.set(refreshToken, { sid, user });
  return { user: { ...user, id: user.userId }, tokens: {
    accessToken: jwt.sign({ sub: user.userId, tenantId: user.tenantId, sid }, { expiresIn: '15m' }), refreshToken,
  } };
}
function active(token: string) {
  const session = sessions.get(token);
  if (!session) throw new UnauthorizedException('Inactive fixture session');
  return session;
}
const auth = {
  registerAdmin: async (input: { email: string; tenantName: string }) => {
    const user: AuthenticatedUser = {
      userId: randomUUID(), tenantId: randomUUID(), email: input.email,
      tenantName: input.tenantName, roles: ['admin'], isActive: true,
    };
    users.set(user.userId, user);
    return issue(user);
  },
  login: async (input: { email: string }) => {
    const user = [...users.values()].find(user => user.email === input.email);
    if (!user) throw new UnauthorizedException('Unknown fixture user');
    return issue(user);
  },
  refreshSession: async (token: string) => {
    const { user } = active(token); sessions.delete(token); return issue(user);
  },
  logout: async (token: string) => { sessions.delete(token); },
  assertActiveRefreshToken: async (token: string) => { active(token); },
};

@Controller('proxy-fixture')
class FixtureController {
  @Post('mutate')
  @UseGuards(JwtAuthGuard)
  mutate(@Req() request: ApiRequest) {
    return { tenantId: request.user?.tenantId, roles: request.user?.roles };
  }
  @Get('headers')
  headers(@Req() request: Request) { return { headers: request.headers, ip: request.ip }; }

  @All('echo')
  async echo(@Req() request: Request, @Res() response: Response) {
    let size = 0; const hash = createHash('sha256');
    for await (const chunk of request) { hash.update(chunk); size += chunk.length; }
    response.status(200).json({ method: request.method, size, sha256: hash.digest('hex'), url: request.originalUrl });
  }

  @Get('browser')
  browser(@Res() response: Response) {
    // Served through the actual proxy. Never shipped in the production module.
    response.type('html').send(`<!doctype html><title>Proxy transport smoke</title>
      <button id="run">Run session smoke</button><pre id="result">Ready</pre>
      <script>
      document.querySelector('#run').onclick = async () => {
        const checks = []; let csrf;
        async function call(path, method='GET', body, extra={}) {
          const result = await fetch('/api/v1/'+path, {method, credentials:'include', cache:'no-store',
            headers:{'Content-Type':'application/json','X-Auth-Mode':'cookie',...extra},
            body:body===undefined?undefined:JSON.stringify(body)});
          return {status:result.status, json:await result.json(), cache:result.headers.get('cache-control')};
        }
        function check(name, ok) { checks.push({name,ok}); if(!ok) throw Error(name); }
        try {
          let r=await call('auth/register-admin','POST',{tenantName:'Proxy synthetic',email:'proxy@example.test',password:'SyntheticPassword123!'});
          check('register',r.status===201 && !r.json.data.tokens); const tenant=r.json.data.user.tenantId;
          check('HttpOnly cookies invisible',!document.cookie.includes('accessToken')&&!document.cookie.includes('refreshToken'));
          r=await call('auth/me'); check('cookie session',r.status===200 && r.json.data.user.tenantId===tenant);
          check('private cache',r.cache.includes('no-store'));
          r=await call('auth/csrf'); csrf=r.json.data.csrfToken;
          r=await call('proxy-fixture/mutate','POST',{}); check('missing CSRF rejected',r.status===403);
          r=await call('proxy-fixture/mutate','POST',{}, {'x-csrf-token':'invalid'}); check('invalid CSRF rejected',r.status===403);
          r=await call('proxy-fixture/mutate','POST',{}, {'x-csrf-token':csrf,'x-tenant-id':'forged','x-role':'editor'});
          check('verified tenant and roles',r.status===201 && r.json.data.tenantId===tenant && r.json.data.roles[0]==='admin');
          r=await call('auth/refresh','POST',{}, {'x-csrf-token':csrf}); check('refresh',r.status===201 && !r.json.data.tokens);
          r=await call('auth/csrf'); check('rotated CSRF',r.json.data.csrfToken!==csrf); const old=csrf; csrf=r.json.data.csrfToken;
          r=await call('proxy-fixture/mutate','POST',{}, {'x-csrf-token':old}); check('old CSRF rejected',r.status===403);
          r=await call('auth/logout','POST',{}, {'x-csrf-token':csrf}); check('logout',r.status===201);
          r=await call('auth/me'); check('logged out',r.status===401);
          r=await call('auth/login','POST',{email:'proxy@example.test',password:'SyntheticPassword123!'}); check('login',r.status===201);
          r=await call('auth/me'); check('login recovered',r.status===200);
          r=await call('internal/metrics'); check('internal metrics blocked',r.status===404);
          check('no local tokens',!localStorage.getItem('testimonial-cms.session'));
          document.querySelector('#result').textContent=JSON.stringify({passed:true,checks},null,2);
        } catch(error) { document.querySelector('#result').textContent=JSON.stringify({passed:false,checks,error:String(error)},null,2); }
      };
      </script>`);
  }
}

export async function startWebProxyFixture(port = 4100, webOrigin = 'http://localhost:3100') {
  if (process.env.RUN_WEB_PROXY_FIXTURE !== '1') throw new Error('Explicit local fixture flag required');
  const module = await Test.createTestingModule({
    controllers: [AuthController, FixtureController], providers: [
      { provide: APP_GUARD, useClass: CsrfGuard }, JwtAuthGuard, SessionCsrfService,
      { provide: JwtService, useValue: jwt },
      { provide: AuthService, useValue: auth },
      { provide: CredentialRepository, useValue: {
        findActiveUser: async (id: string) => users.get(id) ?? null,
        isActiveRefreshSession: async (sid: string) => [...sessions.values()].some(session => session.sid === sid),
      } },
      { provide: ConfigService, useValue: { getOrThrow: () => ({
        corsOrigin: webOrigin, authLegacyStartedAt: null,
        jwt: { secret: 'test-only-proxy-fixture-at-least-32-characters' },
      }) } },
    ],
  }).overrideGuard(RateLimitGuard).useValue({ canActivate: () => true }).compile();
  const app = module.createNestApplication({ logger: false, bodyParser: false });
  app.getHttpAdapter().getInstance().set('trust proxy', false);
  app.use(privateApiCache); app.use(cookieParser());
  app.use((request: Request, response: Response, next: () => void) => {
    if (request.path === '/api/v1/proxy-fixture/echo') next();
    else boundedJsonBody(request, response, next);
  }); app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalInterceptors(new ApiResponseInterceptor()); app.useGlobalFilters(new ApiExceptionFilter());
  await app.listen(port, '127.0.0.1');
  return app;
}
