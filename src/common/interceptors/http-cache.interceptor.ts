import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';
import {
  HTTP_CACHE_KEY,
  HttpCachePolicy,
} from '../decorators/http-cache.decorator';

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const policy =
      this.reflector.getAllAndOverride<HttpCachePolicy>(HTTP_CACHE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'no-store';

    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        if (policy === 'private-short') {
          response.setHeader(
            'Cache-Control',
            'private, max-age=60, must-revalidate',
          );
          response.setHeader('Vary', 'Authorization');
          return;
        }

        response.setHeader(
          'Cache-Control',
          'private, no-store, no-cache, must-revalidate',
        );
      }),
    );
  }
}
