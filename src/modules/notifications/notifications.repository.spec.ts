import { Test, TestingModule } from '@nestjs/testing';
import {
  NotificationDeliveryStatus,
  NotificationDeliveryType,
  Prisma,
} from '../../generated/prisma';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationsRepository } from './notifications.repository';

describe('NotificationsRepository.claimDelivery', () => {
  let repository: NotificationsRepository;
  let prisma: {
    notificationDelivery: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      notificationDelivery: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(NotificationsRepository);
  });

  it('claims a new delivery row', async () => {
    prisma.notificationDelivery.create.mockResolvedValue({
      id: 'd1',
      status: NotificationDeliveryStatus.PENDING,
    });

    const result = await repository.claimDelivery({
      userId: 'user-1',
      localDate: '2026-07-30',
    });

    expect(result.claimed).toBe(true);
    expect(prisma.notificationDelivery.create).toHaveBeenCalled();
  });

  it('reclaims FAILED deliveries for retry', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('conflict', {
      code: 'P2002',
      clientVersion: 'test',
    });
    prisma.notificationDelivery.create.mockRejectedValue(conflict);
    prisma.notificationDelivery.findUnique.mockResolvedValue({
      id: 'd1',
      status: NotificationDeliveryStatus.FAILED,
      updatedAt: new Date('2026-07-30T00:00:00.000Z'),
    });
    prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });
    prisma.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: 'd1',
      status: NotificationDeliveryStatus.PENDING,
    });

    const result = await repository.claimDelivery({
      userId: 'user-1',
      localDate: '2026-07-30',
    });

    expect(result.claimed).toBe(true);
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledTimes(1);
    const updateCalls = prisma.notificationDelivery.updateMany.mock
      .calls as Array<
      [{ where: { id: string; status: { in: NotificationDeliveryStatus[] } } }]
    >;
    expect(updateCalls[0][0].where.id).toBe('d1');
    expect(updateCalls[0][0].where.status.in).toEqual([
      NotificationDeliveryStatus.FAILED,
      NotificationDeliveryStatus.PENDING,
    ]);
  });

  it('does not reclaim SENT deliveries', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('conflict', {
      code: 'P2002',
      clientVersion: 'test',
    });
    prisma.notificationDelivery.create.mockRejectedValue(conflict);
    prisma.notificationDelivery.findUnique.mockResolvedValue({
      id: 'd1',
      status: NotificationDeliveryStatus.SENT,
      updatedAt: new Date(),
    });

    const result = await repository.claimDelivery({
      userId: 'user-1',
      localDate: '2026-07-30',
    });

    expect(result.claimed).toBe(false);
    expect(result.delivery.status).toBe(NotificationDeliveryStatus.SENT);
    expect(prisma.notificationDelivery.updateMany).not.toHaveBeenCalled();
    expect(NotificationDeliveryType.DAILY_REMINDER).toBeDefined();
  });
});
