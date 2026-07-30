import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';

export function isPrismaUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export function throwIfUniqueConflict(error: unknown, message: string): never {
  if (isPrismaUniqueConflict(error)) {
    throw new ConflictException(message);
  }

  throw error;
}
