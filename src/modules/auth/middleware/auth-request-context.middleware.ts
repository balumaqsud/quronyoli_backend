import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AuthRequestContext } from '../interfaces/auth-request-context.interface';

interface RequestWithAuthContext extends Request {
  authContext?: AuthRequestContext;
}

@Injectable()
export class AuthRequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithAuthContext, _res: Response, next: NextFunction): void {
    const forwardedForHeader = req.headers['x-forwarded-for'];
    const forwardedFor =
      typeof forwardedForHeader === 'string'
        ? forwardedForHeader
        : Array.isArray(forwardedForHeader)
          ? forwardedForHeader[0]
          : undefined;
    const forwardedIp = forwardedFor?.split(',')[0]?.trim();

    const socketAddress = req.socket.remoteAddress;
    const candidateIp =
      forwardedIp ??
      (typeof req.ip === 'string' ? req.ip : undefined) ??
      (typeof socketAddress === 'string' ? socketAddress : undefined);

    const userAgentHeader = req.headers['user-agent'];
    const candidateUserAgent =
      typeof userAgentHeader === 'string'
        ? userAgentHeader
        : Array.isArray(userAgentHeader)
          ? userAgentHeader[0]
          : undefined;

    const context: AuthRequestContext = {
      ipAddress:
        typeof candidateIp === 'string' ? candidateIp.slice(0, 128) : undefined,
      userAgent:
        typeof candidateUserAgent === 'string'
          ? candidateUserAgent.slice(0, 512)
          : undefined,
    };

    req.authContext = context;
    next();
  }
}
