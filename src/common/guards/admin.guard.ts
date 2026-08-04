import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { Admin } from '../../generated/prisma';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthenticatedUser } from '../../infrastructure/auth/interfaces/jwt-payload.interface';

interface RequestWithAdmin extends Request {
  user?: AuthenticatedUser;
  admin?: Admin;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const user = request.user;

    if (!user?.sub) {
      throw new UnauthorizedException('Authentication required');
    }

    const dbUser = await this.prisma.user.findFirst({
      where: {
        id: user.sub,
        isActive: true,
        deletedAt: null,
      },
      include: {
        admin: true,
      },
    });

    if (!dbUser) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (dbUser.isBanned) {
      throw new ForbiddenException('User is banned');
    }

    if (!dbUser.admin) {
      throw new ForbiddenException('Admin access required');
    }

    request.admin = dbUser.admin;
    return true;
  }
}
