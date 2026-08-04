import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { Admin, AdminRole } from '../../generated/prisma';

export type CurrentAdminContext = {
  id: string;
  userId: string;
  role: AdminRole;
};

interface RequestWithAdmin extends Request {
  admin?: Admin;
}

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentAdminContext => {
    const request = ctx.switchToHttp().getRequest<RequestWithAdmin>();

    if (!request.admin) {
      throw new ForbiddenException('Admin access required');
    }

    return {
      id: request.admin.id,
      userId: request.admin.userId,
      role: request.admin.role,
    };
  },
);
