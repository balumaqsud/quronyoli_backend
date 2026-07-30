import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { HttpCacheInterceptor } from './http-cache.interceptor';

describe('HttpCacheInterceptor', () => {
  it('sets no-store by default', (done) => {
    const setHeader = jest.fn();
    const interceptor = new HttpCacheInterceptor(new Reflector());
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getResponse: () => ({ setHeader }),
      }),
    } as unknown as ExecutionContext;

    interceptor
      .intercept(context, { handle: () => of({ ok: true }) } as CallHandler)
      .subscribe({
        complete: () => {
          expect(setHeader).toHaveBeenCalledWith(
            'Cache-Control',
            'private, no-store, no-cache, must-revalidate',
          );
          done();
        },
      });
  });

  it('sets private-short when metadata is present', (done) => {
    const setHeader = jest.fn();
    const reflector = {
      getAllAndOverride: () => 'private-short',
    } as unknown as Reflector;
    const interceptor = new HttpCacheInterceptor(reflector);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getResponse: () => ({ setHeader }),
      }),
    } as unknown as ExecutionContext;

    interceptor
      .intercept(context, { handle: () => of({ ok: true }) } as CallHandler)
      .subscribe({
        complete: () => {
          expect(setHeader).toHaveBeenCalledWith(
            'Cache-Control',
            'private, max-age=60, must-revalidate',
          );
          expect(setHeader).toHaveBeenCalledWith('Vary', 'Authorization');
          done();
        },
      });
  });
});
