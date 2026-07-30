import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { QfCatalogRepository } from './qf-catalog.repository';

describe('QfCatalogRepository', () => {
  const upsert = jest.fn();
  const updateMany = jest.fn();
  const tx = {
    quranTranslation: {
      upsert,
      updateMany,
    },
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  } as unknown as PrismaService;

  let repository: QfCatalogRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new QfCatalogRepository(prisma);
    upsert.mockResolvedValue({});
    updateMany.mockResolvedValue({ count: 1 });
  });

  it('upserts seen translations and deactivates missing active rows', async () => {
    const stats = await repository.syncTranslations([
      {
        provider: 'quran.foundation',
        externalId: '20',
        languageCode: 'en',
        name: 'Saheeh',
        authorName: null,
        slug: null,
        isActive: true,
        deletedAt: null,
        metadata: {},
      },
    ]);

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        provider: 'quran.foundation',
        isActive: true,
        externalId: { notIn: ['20'] },
      },
      data: { isActive: false },
    });
    expect(stats).toEqual({ upserted: 1, deactivated: 1, seen: 1 });
  });
});
