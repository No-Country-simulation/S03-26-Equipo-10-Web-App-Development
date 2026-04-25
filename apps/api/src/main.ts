import { ZodValidationPipe } from 'nestjs-zod';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response, json, urlencoded } from 'express';
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

/**
 * Inicializa y arranca la aplicación NestJS.
 * Configura middlewares globales, filtros de excepciones, interceptores,
 * validación de tuberías (pipes) y la documentación de Swagger.
 *
 * @returns {Promise<void>} Una promesa que se resuelve cuando la aplicación está escuchando.
 */
async function bootstrap() {
  // Crea la instancia de la aplicación NestJS con logging en buffer
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  
  // Configura Pino como el logger principal
  app.useLogger(app.get(Logger));
  
  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig>('app')!;

  // Configuración de CORS basada en la configuración de entorno
  app.enableCors({
    origin: [appConfig.corsOrigin],
    credentials: true,
  });

  // Límites para peticiones JSON y URL encoded
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

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
    new LoggingInterceptor(),
    new ApiResponseInterceptor(), // Estandariza la respuesta (data, status)
    app.get(IdempotencyInterceptor), // Previene envíos duplicados basados en headers
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
