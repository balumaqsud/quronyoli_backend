import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Admin, AdminRole } from '../../generated/prisma';
import { ROLES_KEY } from '../constants';

interface RequestWithAdmin extends Request {
  admin?: Admin;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const admin = request.admin;

    if (!admin) {
      throw new ForbiddenException('Admin access required');
    }

    if (!requiredRoles.includes(admin.role)) {
      throw new ForbiddenException('Insufficient admin role');
    }

    return true;
  }
}
