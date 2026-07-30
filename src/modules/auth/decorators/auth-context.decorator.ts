import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthRequestContext } from '../interfaces/auth-request-context.interface';

interface RequestWithAuthContext extends Request {
  authContext?: AuthRequestContext;
}

export const AuthContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthRequestContext => {
    const request = ctx.switchToHttp().getRequest<RequestWithAuthContext>();
    return request.authContext ?? {};
  },
);
