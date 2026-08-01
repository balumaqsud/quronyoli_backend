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

  it('upserts ayah and chapter reciters without colliding on externalId', async () => {
    const quranReciter = {
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const reciterTx = { quranReciter };
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (client: typeof reciterTx) => Promise<unknown>) =>
        fn(reciterTx),
    );

    await repository.syncReciters(
      [
        {
          provider: 'quran.foundation',
          externalId: '7',
          kind: 'AYAH',
          name: 'Alafasy',
          arabicName: null,
          style: null,
          slug: null,
          isActive: true,
          deletedAt: null,
          metadata: {},
        },
      ],
      'AYAH',
    );
    await repository.syncReciters(
      [
        {
          provider: 'quran.foundation',
          externalId: '7',
          kind: 'CHAPTER',
          name: 'Chapter Alafasy',
          arabicName: null,
          style: null,
          slug: null,
          isActive: true,
          deletedAt: null,
          metadata: {},
        },
      ],
      'CHAPTER',
    );

    expect(quranReciter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider_externalId_kind: {
            provider: 'quran.foundation',
            externalId: '7',
            kind: 'AYAH',
          },
        },
      }),
    );
    expect(quranReciter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider_externalId_kind: {
            provider: 'quran.foundation',
            externalId: '7',
            kind: 'CHAPTER',
          },
        },
      }),
    );
    expect(quranReciter.updateMany).toHaveBeenCalledWith({
      where: {
        provider: 'quran.foundation',
        kind: 'AYAH',
        isActive: true,
        externalId: { notIn: ['7'] },
      },
      data: { isActive: false },
    });
    expect(quranReciter.updateMany).toHaveBeenCalledWith({
      where: {
        provider: 'quran.foundation',
        kind: 'CHAPTER',
        isActive: true,
        externalId: { notIn: ['7'] },
      },
      data: { isActive: false },
    });
  });
});
