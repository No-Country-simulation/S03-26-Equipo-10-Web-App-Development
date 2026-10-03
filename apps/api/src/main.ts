import { ZodValidationPipe } from 'nestjs-zod';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { AppConfig } from './config/app.config';
import { boundedJsonBody, formBody } from './common/middleware/body-limits.middleware';
import { MetricsService } from './common/observability/metrics.service';

/**
 * Inicializa y arranca la aplicación NestJS.
 * Configura middlewares globales, filtros de excepciones, interceptores,
 * validación de tuberías (pipes) y la documentación de Swagger.
 *
 * @returns {Promise<void>} Una promesa que se resuelve cuando la aplicación está escuchando.
 */
async function bootstrap() {
  // Crea la instancia de la aplicación NestJS con logging en buffer
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  
  // Configura Pino como el logger principal
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks(['SIGTERM', 'SIGINT']);
  
  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig>('app');
  if (!appConfig) {
    throw new Error('Missing app configuration — verificá que ConfigModule.forRoot() esté cargando app.config correctamente.');
  }

  // Confiar solo en los saltos del ingress controlado; nunca leer XFF a mano.
  // La API debe permanecer inaccesible directamente cuando este valor sea > 0.
  app.getHttpAdapter().getInstance().set('trust proxy', appConfig.trustedProxyHops);

  // Configuración de CORS basada en la configuración de entorno
  app.enableCors({
    origin: [appConfig.corsOrigin],
    credentials: true,
  });

  const metrics = app.get(MetricsService);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = process.hrtime.bigint();
    res.once('finish', () => {
      const route = req.route?.path;
      metrics.recordHttp(req.method, typeof route === 'string' ? route : 'unmatched',
        res.statusCode, Number(process.hrtime.bigint() - started) / 1_000_000);
    });
    next();
  });

  // Límites para peticiones JSON y URL encoded
  app.use(boundedJsonBody);
  app.use(formBody);

  // Inicializa el contexto de la petición para poder acceder a datos del usuario
  // en cualquier capa de la aplicación (usando ALS)
  const requestContext = new RequestContextMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) =>
    requestContext.use(req, res, next),
  );

  // Seguridad: Helmet y parseo de cookies
  app.use(helmet());
  app.use(cookieParser());
  
  // Prefijo global para todos los endpoints de la API
  app.setGlobalPrefix('api/v1');
  
  // Habilita la validación basada en Zod a nivel global
  app.useGlobalPipes(new ZodValidationPipe());

  // Registra filtros de excepciones y múltiples interceptores globales
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(
    app.get(LoggingInterceptor),
    new ApiResponseInterceptor(),
    app.get(IdempotencyInterceptor),
  );

  const config = new DocumentBuilder()
    .setTitle('Testimonials CMS API')
    .setDescription('The API description for the Testimonials CMS')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('accessToken', {
      type: 'apiKey',
      in: 'cookie',
      name: 'accessToken',
    })
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(appConfig.port);
}

void bootstrap();
