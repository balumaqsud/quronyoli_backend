import { ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerLimitDetail,
} from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as AuthenticatedUser | undefined;
    if (user?.sub) {
      return Promise.resolve(`user:${user.sub}`);
    }

    const expressReq = req as unknown as Request;
    const forwarded = expressReq.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0]?.trim();
    return Promise.resolve(`ip:${forwardedIp || expressReq.ip || 'unknown'}`);
  }

  protected throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();
    const retryAfterSeconds = Math.max(1, throttlerLimitDetail.timeToExpire);
    response.setHeader('Retry-After', String(retryAfterSeconds));
    throw new ThrottlerException();
  }
}
