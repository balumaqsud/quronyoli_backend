import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SessionsRepository } from '../../auth/sessions.repository';
import { AdminLogsService } from '../logs/admin-logs.service';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let sessionsRepository: jest.Mocked<
    Pick<SessionsRepository, 'revokeAllForUser'>
  >;
  let adminLogsService: jest.Mocked<Pick<AdminLogsService, 'create'>>;

  const admin = { id: 'admin-1', role: 'ADMIN' as const, userId: 'admin-user' };
  const context = { ipAddress: '127.0.0.1', userAgent: 'test' };

  const userRow = {
    id: 'user-1',
    telegramId: '42',
    isBanned: false,
    isActive: true,
    deletedAt: null,
    admin: null,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    sessionsRepository = {
      revokeAllForUser: jest.fn().mockResolvedValue(2),
    };
    adminLogsService = {
      create: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: SessionsRepository, useValue: sessionsRepository },
        { provide: AdminLogsService, useValue: adminLogsService },
      ],
    }).compile();

    service = module.get(AdminUsersService);
  });

  it('bans a user and revokes all sessions', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow);
    prisma.user.update.mockResolvedValue({ ...userRow, isBanned: true });

    await expect(service.ban('user-1', admin, context)).resolves.toMatchObject({
      id: 'user-1',
      isBanned: true,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { isBanned: true },
      include: { admin: { select: { id: true, role: true } } },
    });
    expect(sessionsRepository.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(adminLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'BANNED',
        entity: 'User',
        entityId: 'user-1',
      }),
    );
  });

  it('deactivates a user and revokes all sessions', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow);
    prisma.user.update.mockResolvedValue({
      ...userRow,
      isActive: false,
      deletedAt: new Date(),
    });

    await expect(
      service.deactivate('user-1', admin, context),
    ).resolves.toMatchObject({
      id: 'user-1',
      isActive: false,
    });

    expect(sessionsRepository.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(adminLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DEACTIVATED',
        entity: 'User',
      }),
    );
  });

  it('throws when banning a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.ban('missing', admin, context)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(sessionsRepository.revokeAllForUser).not.toHaveBeenCalled();
  });
});
