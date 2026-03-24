import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:3000'],
    credentials: true,
  });

  const requestContext = new RequestContextMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) =>
    requestContext.use(req, res, next),
  );

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(
    new ApiResponseInterceptor(),
    app.get(IdempotencyInterceptor),
  );

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();
