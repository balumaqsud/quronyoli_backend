import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { QfCatalogRepository } from './qf-catalog.repository';

type UpsertCallArg = {
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

function upsertArgAt(mockFn: jest.Mock, index: number): UpsertCallArg {
  const calls = mockFn.mock.calls as unknown[][];
  const arg = calls[index]?.[0];
  if (!arg || typeof arg !== 'object') {
    throw new Error(`Expected upsert call at index ${index}`);
  }
  return arg as UpsertCallArg;
}

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

  it('creates curated translations active and omits isActive on update', async () => {
    const stats = await repository.syncTranslations([
      {
        provider: 'quran.foundation',
        externalId: '55',
        languageCode: 'uz',
        name: 'MSM Yusuf',
        authorName: null,
        slug: null,
        isActive: false,
        deletedAt: null,
        metadata: {},
      },
    ]);

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsertArgAt(upsert, 0);
    expect(call.create).toMatchObject({
      externalId: '55',
      isActive: true,
    });
    expect(call.update).not.toHaveProperty('isActive');
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        provider: 'quran.foundation',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest asymmetric matcher
        externalId: { in: expect.arrayContaining(['55']) },
        deletedAt: null,
        isActive: false,
      },
      data: { isActive: true },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        provider: 'quran.foundation',
        languageCode: 'kazakh',
      },
      data: { languageCode: 'kk' },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        provider: 'quran.foundation',
        isActive: true,
        externalId: { notIn: ['55'] },
      },
      data: { isActive: false },
    });
    expect(stats).toEqual({ upserted: 1, deactivated: 1, seen: 1 });
  });

  it('creates non-curated translations inactive and omits isActive on update', async () => {
    const stats = await repository.syncTranslations([
      {
        provider: 'quran.foundation',
        externalId: '999',
        languageCode: 'en',
        name: 'Other',
        authorName: null,
        slug: null,
        isActive: true,
        deletedAt: null,
        metadata: {},
      },
    ]);

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsertArgAt(upsert, 0);
    expect(call.create).toMatchObject({
      externalId: '999',
      isActive: false,
    });
    expect(call.update).not.toHaveProperty('isActive');
    expect(call.update).toMatchObject({
      languageCode: 'en',
      name: 'Other',
      deletedAt: null,
    });
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        provider: 'quran.foundation',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest asymmetric matcher
        externalId: { in: expect.arrayContaining(['55']) },
        deletedAt: null,
        isActive: false,
      },
      data: { isActive: true },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        provider: 'quran.foundation',
        isActive: true,
        externalId: { notIn: ['999'] },
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest asymmetric matcher
        create: expect.objectContaining({ isActive: true }),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest asymmetric matcher
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest asymmetric matcher
        create: expect.objectContaining({ isActive: true }),
      }),
    );
    const chapterUpdate = upsertArgAt(quranReciter.upsert, 1).update;
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
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  });

  it('finds active translation by externalId with optional provider', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'ky-row' });
    (
      prisma as unknown as { quranTranslation: { findFirst: jest.Mock } }
    ).quranTranslation.findFirst = findFirst;

    await expect(
      repository.findActiveTranslationByExternalId('kyrgyz_hakimov', {
        provider: 'quranenc',
      }),
    ).resolves.toEqual({ id: 'ky-row' });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        externalId: 'kyrgyz_hakimov',
        isActive: true,
        deletedAt: null,
        provider: 'quranenc',
      },
    });
  });

  it('finds active translations by externalIds in one query', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'ky-row' }]);
    (
      prisma as unknown as { quranTranslation: { findMany: jest.Mock } }
    ).quranTranslation.findMany = findMany;

    await expect(
      repository.findActiveTranslationsByExternalIds(['kyrgyz_hakimov'], {
        provider: 'quranenc',
      }),
    ).resolves.toEqual([{ id: 'ky-row' }]);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        externalId: { in: ['kyrgyz_hakimov'] },
        isActive: true,
        deletedAt: null,
        provider: 'quranenc',
      },
    });
  });

  it('returns empty list without querying when externalIds is empty', async () => {
    const findMany = jest.fn();
    (
      prisma as unknown as { quranTranslation: { findMany: jest.Mock } }
    ).quranTranslation.findMany = findMany;

    await expect(
      repository.findActiveTranslationsByExternalIds([]),
    ).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('lists active tafsirs with optional language filter', async () => {
    const tafsirFindMany = (
      prisma as unknown as {
        quranTafsir: { findMany: jest.Mock };
      }
    ).quranTafsir.findMany;
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
    findMany.mockResolvedValueOnce([{ id: 'r1' }]);

    await expect(
      repository.listActiveReciters({ kind: 'CHAPTER' }),
    ).resolves.toEqual([{ id: 'r1' }]);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        kind: 'CHAPTER',
        isActive: true,
        deletedAt: null,
      },
      orderBy: [{ isPopular: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  });
});
