import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { QfCatalogSyncService } from '../../quran/catalog/qf-catalog-sync.service';
import { AdminLogsService } from '../logs/admin-logs.service';
import { AdminTranslationsService } from './admin-translations.service';

describe('AdminTranslationsService', () => {
  let service: AdminTranslationsService;
  let prisma: {
    quranTranslation: {
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let adminLogsService: jest.Mocked<Pick<AdminLogsService, 'create'>>;

  const admin = { id: 'admin-1', role: 'ADMIN' as const, userId: 'admin-user' };
  const context = { ipAddress: '127.0.0.1', userAgent: 'test' };

  const translation = {
    id: '11111111-1111-4111-8111-111111111111',
    externalId: '55',
    isActive: true,
    isDefault: true,
    sortOrder: 0,
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      quranTranslation: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
        }
        return Promise.all(arg as Promise<unknown>[]);
      }),
    };
    adminLogsService = {
      create: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminTranslationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AdminLogsService, useValue: adminLogsService },
        {
          provide: QfCatalogSyncService,
          useValue: { syncTranslationsOnly: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AdminTranslationsService);
  });

  it('clears isDefault when disabling a translation', async () => {
    prisma.quranTranslation.findFirst.mockResolvedValue(translation);
    prisma.quranTranslation.update.mockResolvedValue({
      ...translation,
      isActive: false,
      isDefault: false,
    });

    await expect(
      service.disable(translation.id, admin, context),
    ).resolves.toMatchObject({
      isActive: false,
      isDefault: false,
      resourceId: '55',
    });

    expect(prisma.quranTranslation.update).toHaveBeenCalledWith({
      where: { id: translation.id },
      data: { isActive: false, isDefault: false },
    });
  });

  it('exposes QF externalId as resourceId on list/detail', async () => {
    prisma.quranTranslation.findMany.mockResolvedValue([translation]);
    prisma.quranTranslation.count.mockResolvedValue(1);
    prisma.quranTranslation.findFirst.mockResolvedValue(translation);

    await expect(service.list({ page: 1, limit: 20 })).resolves.toMatchObject({
      items: [{ id: translation.id, resourceId: '55', externalId: '55' }],
      meta: { total: 1, page: 1, limit: 20 },
    });
    await expect(service.getById(translation.id)).resolves.toMatchObject({
      resourceId: '55',
      externalId: '55',
    });
  });

  it('setDefault makes translation exclusive default and active', async () => {
    prisma.quranTranslation.findFirst.mockResolvedValue({
      ...translation,
      isActive: false,
      isDefault: false,
    });
    prisma.quranTranslation.updateMany.mockResolvedValue({ count: 1 });
    prisma.quranTranslation.update.mockResolvedValue({
      ...translation,
      isActive: true,
      isDefault: true,
    });

    await expect(
      service.setDefault(translation.id, admin, context),
    ).resolves.toMatchObject({
      isDefault: true,
      isActive: true,
    });

    expect(prisma.quranTranslation.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    expect(prisma.quranTranslation.update).toHaveBeenCalledWith({
      where: { id: translation.id },
      data: { isDefault: true, isActive: true },
    });
  });

  it('rejects reorder when an id is missing', async () => {
    prisma.quranTranslation.count.mockResolvedValue(1);

    await expect(
      service.reorder(
        {
          ids: [
            '11111111-1111-4111-8111-111111111111',
            '22222222-2222-4222-8222-222222222222',
          ],
        },
        admin,
        context,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
