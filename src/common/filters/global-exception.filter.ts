import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AppConfig } from '../../config/configuration';
import { CONFIG_KEYS, REQUEST_ID_HEADER } from '../constants';
import { ApiErrorResponse } from '../interfaces/api-response.interface';

interface ExceptionResponseBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(GlobalExceptionFilter.name)
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const appConfig = this.configService.getOrThrow<AppConfig>(CONFIG_KEYS.APP);
    const isProduction = appConfig.nodeEnv === 'production';

    const requestIdHeader = request.headers[REQUEST_ID_HEADER];
    const requestId = Array.isArray(requestIdHeader)
      ? requestIdHeader[0]
      : requestIdHeader;

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error';
    let error = HttpStatus[statusCode] ?? 'Error';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const payload = exceptionResponse as ExceptionResponseBody;
      message = payload.message ?? message;
      error = payload.error ?? error;
    } else if (exception instanceof Error && !isProduction) {
      message = exception.message;
    }

    if (isProduction && statusCode >= 500) {
      message = 'Internal server error';
    }

    this.logger.error(
      {
        err: exception,
        statusCode,
        path: request.url,
        method: request.method,
        requestId,
      },
      'Request failed',
    );

    const body: ApiErrorResponse = {
      success: false,
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(requestId ? { requestId } : {}),
    };

    response.status(statusCode).json(body);
  }
}
