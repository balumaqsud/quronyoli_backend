import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { mkdirSync } from 'fs';
import helmet from 'helmet';
import { Logger as PinoNestLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig, HttpConfig } from './config/configuration';
import { CONFIG_KEYS } from './common/constants';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  const logger = app.get(PinoNestLogger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const appConfig = configService.getOrThrow<AppConfig>(CONFIG_KEYS.APP);
  const httpConfig = configService.getOrThrow<HttpConfig>(CONFIG_KEYS.HTTP);
  const isProduction = appConfig.nodeEnv === 'production';

  mkdirSync(appConfig.uploadsDir, { recursive: true });
  mkdirSync(appConfig.logDir, { recursive: true });

  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: unknown) => void;
    disable: (key: string) => void;
  };
  expressApp.disable('x-powered-by');

  if (appConfig.trustProxy) {
    expressApp.set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(json({ limit: appConfig.bodyLimit }));
  app.use(urlencoded({ extended: true, limit: appConfig.bodyLimit }));

  app.enableCors({
    origin: appConfig.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Telegram-Init-Data',
      'ngrok-skip-browser-warning',
    ],
  });

  app.setGlobalPrefix(appConfig.apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: appConfig.apiVersion,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  if (appConfig.swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Quron Yo'li API")
      .setDescription("REST API for the Quron Yo'li Telegram Mini App")
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token',
        },
        'access-token',
      )
      .addCookieAuth('refresh_token', {
        type: 'apiKey',
        in: 'cookie',
        name: 'refresh_token',
      })
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(appConfig.swaggerPath, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  app.enableShutdownHooks();

  await app.listen(appConfig.port);

  const server = app.getHttpServer() as {
    requestTimeout?: number;
    headersTimeout?: number;
    setTimeout?: (ms: number) => void;
  };
  const timeoutMs = httpConfig.requestTimeoutMs;
  if (typeof server.setTimeout === 'function') {
    server.setTimeout(timeoutMs);
  }
  server.requestTimeout = timeoutMs;
  server.headersTimeout = timeoutMs + 5_000;

  const appUrl = await app.getUrl();
  Logger.log(
    `${appConfig.name} is running on ${appUrl}/${appConfig.apiPrefix}/v${appConfig.apiVersion}`,
    'Bootstrap',
  );

  if (appConfig.swaggerEnabled) {
    Logger.log(`Swagger docs: ${appUrl}/${appConfig.swaggerPath}`, 'Bootstrap');
  }
}

process.on('uncaughtException', (error: Error) => {
  Logger.error(
    `Uncaught exception: ${error.message}`,
    error.stack,
    'Process',
  );
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  const message =
    reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  Logger.error(`Unhandled rejection: ${message}`, stack, 'Process');
  process.exit(1);
});

void bootstrap();
