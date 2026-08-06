import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { QfCatalogSyncService } from '../../quran/catalog/qf-catalog-sync.service';
import { AdminLogsService } from '../logs/admin-logs.service';
import { AdminTafsirsService } from './admin-tafsirs.service';

describe('AdminTafsirsService', () => {
  let service: AdminTafsirsService;
  let prisma: {
    quranTafsir: {
      findFirst: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let adminLogsService: jest.Mocked<Pick<AdminLogsService, 'create'>>;

  const admin = { id: 'admin-1', role: 'ADMIN' as const, userId: 'admin-user' };
  const context = { ipAddress: '127.0.0.1', userAgent: 'test' };

  const tafsir = {
    id: '33333333-3333-4333-8333-333333333333',
    isActive: false,
    sortOrder: 0,
    deletedAt: null,
    name: 'Ibn Kathir',
  };

  beforeEach(async () => {
    prisma = {
      quranTafsir: {
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (
            arg as (tx: typeof prisma) => Promise<unknown>
          )(prisma);
        }
        return Promise.all(arg as Promise<unknown>[]);
      }),
    };
    adminLogsService = {
      create: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminTafsirsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AdminLogsService, useValue: adminLogsService },
        {
          provide: QfCatalogSyncService,
          useValue: { syncTafsirsOnly: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AdminTafsirsService);
  });

  it('enables a tafsir for Mini App / settings gating', async () => {
    prisma.quranTafsir.findFirst.mockResolvedValue(tafsir);
    prisma.quranTafsir.update.mockResolvedValue({
      ...tafsir,
      isActive: true,
    });

    await expect(
      service.enable(tafsir.id, admin, context),
    ).resolves.toMatchObject({
      isActive: true,
    });

    expect(prisma.quranTafsir.update).toHaveBeenCalledWith({
      where: { id: tafsir.id },
      data: { isActive: true },
    });
    expect(adminLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ENABLED',
        entity: 'Tafsir',
        entityId: tafsir.id,
      }),
    );
  });

  it('throws when enabling a missing tafsir', async () => {
    prisma.quranTafsir.findFirst.mockResolvedValue(null);

    await expect(
      service.enable(tafsir.id, admin, context),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
