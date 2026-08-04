import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '../../generated/prisma';
import { ROLES_KEY } from '../constants';

export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
