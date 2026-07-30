import {
  CallHandler,
  ExecutionContext,
  GatewayTimeoutException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, tap, timeout } from 'rxjs/operators';
import { CONFIG_KEYS } from '../constants';
import { AppConfig, HttpConfig } from '../../config/configuration';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly requestTimeoutMs: number;
  private readonly slowRequestMs: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectPinoLogger(TimeoutInterceptor.name)
    private readonly logger: PinoLogger,
  ) {
    this.requestTimeoutMs = this.configService.getOrThrow<HttpConfig>(
      CONFIG_KEYS.HTTP,
    ).requestTimeoutMs;
    this.slowRequestMs = this.configService.getOrThrow<AppConfig>(
      CONFIG_KEYS.APP,
    ).slowRequestMs;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const started = Date.now();
    const request = context.switchToHttp().getRequest<{
      method?: string;
      url?: string;
    }>();

    return next.handle().pipe(
      timeout(this.requestTimeoutMs),
      tap(() => {
        const durationMs = Date.now() - started;
        if (durationMs >= this.slowRequestMs) {
          this.logger.warn(
            {
              durationMs,
              method: request.method,
              url: request.url,
            },
            'Slow request',
          );
        }
      }),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          return throwError(
            () =>
              new GatewayTimeoutException(
                `Request exceeded ${this.requestTimeoutMs}ms timeout`,
              ),
          );
        }
        return throwError(() => error);
      }),
    );
  }
}
