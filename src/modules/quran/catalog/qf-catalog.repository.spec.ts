import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { QfCatalogRepository } from './qf-catalog.repository';

describe('QfCatalogRepository', () => {
  const upsert = jest.fn();
  const updateMany = jest.fn();
  const findMany = jest.fn();
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
    quranTranslation: { findMany },
    quranTafsir: { findMany: jest.fn() },
    quranReciter: { findMany },
  } as unknown as PrismaService;

  let repository: QfCatalogRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new QfCatalogRepository(prisma);
    upsert.mockResolvedValue({});
    updateMany.mockResolvedValue({ count: 1 });
    findMany.mockResolvedValue([]);
  });

  it('creates translations inactive and omits isActive on update', async () => {
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
    const call = upsert.mock.calls[0][0];
    expect(call.create).toMatchObject({
      externalId: '20',
      isActive: false,
    });
    expect(call.update).not.toHaveProperty('isActive');
    expect(call.update).toMatchObject({
      languageCode: 'en',
      name: 'Saheeh',
      deletedAt: null,
    });
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
        create: expect.objectContaining({ isActive: true }),
        update: expect.not.objectContaining({ isActive: expect.anything() }),
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
        create: expect.objectContaining({ isActive: true }),
      }),
    );
    const chapterUpdate = quranReciter.upsert.mock.calls[1][0].update;
    expect(chapterUpdate).not.toHaveProperty('isActive');

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

  it('lists active translations with optional language filter', async () => {
    findMany.mockResolvedValueOnce([{ id: 't1' }]);

    await expect(
      repository.listActiveTranslations({ languageCode: 'uz' }),
    ).resolves.toEqual([{ id: 't1' }]);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        deletedAt: null,
        languageCode: 'uz',
      },
      orderBy: [
        { isDefault: 'desc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });
  });

  it('lists active tafsirs with optional language filter', async () => {
    const tafsirFindMany = (prisma as unknown as {
      quranTafsir: { findMany: jest.Mock };
    }).quranTafsir.findMany;
    tafsirFindMany.mockResolvedValueOnce([{ id: 'tf1' }]);

    await expect(
      repository.listActiveTafsirs({ languageCode: 'en' }),
    ).resolves.toEqual([{ id: 'tf1' }]);

    expect(tafsirFindMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        deletedAt: null,
        languageCode: 'en',
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  });

  it('lists active reciters by kind', async () => {
    (prisma.quranReciter.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'r1' },
    ]);

    await expect(
      repository.listActiveReciters({ kind: 'CHAPTER' }),
    ).resolves.toEqual([{ id: 'r1' }]);

    expect(prisma.quranReciter.findMany).toHaveBeenCalledWith({
      where: {
        kind: 'CHAPTER',
        isActive: true,
        deletedAt: null,
      },
      orderBy: [
        { isPopular: 'desc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });
  });
});
