import { PinoLogger } from 'nestjs-pino';
import { QuranFoundationClient } from '../client/quran-foundation.client';
import { QfCatalogRepository } from './qf-catalog.repository';
import { QfCatalogSyncService } from './qf-catalog-sync.service';

describe('QfCatalogSyncService', () => {
  const getContent = jest.fn();
  const syncTranslations = jest.fn();
  const syncTafsirs = jest.fn();
  const syncReciters = jest.fn();

  const client = {
    getContent,
  } as unknown as QuranFoundationClient;

  const repository = {
    syncTranslations,
    syncTafsirs,
    syncReciters,
  } as unknown as QfCatalogRepository;

  const logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  } as unknown as PinoLogger;

  let service: QfCatalogSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QfCatalogSyncService(client, repository, logger);

    getContent.mockImplementation((path: string) => {
      if (path === '/resources/translations') {
        return Promise.resolve({
          translations: [
            {
              id: 20,
              name: 'Saheeh International',
              author_name: 'Saheeh International',
              slug: 'en-sahih-international',
              language_name: 'english',
            },
          ],
        });
      }
      if (path === '/resources/tafsirs') {
        return Promise.resolve({
          tafsirs: [
            {
              id: 169,
              name: 'Ibn Kathir (Abridged)',
              author_name: 'Hafiz Ibn Kathir',
              slug: 'en-tafisr-ibn-kathir',
              language_name: 'english',
            },
          ],
        });
      }
      if (path === '/resources/recitations') {
        return Promise.resolve({
          recitations: [
            {
              id: 7,
              reciter_name: 'Mishari Rashid al-`Afasy',
              style: null,
            },
          ],
        });
      }
      return Promise.reject(new Error(`Unexpected path ${path}`));
    });

    syncTranslations.mockResolvedValue({
      upserted: 1,
      deactivated: 0,
      seen: 1,
    });
    syncTafsirs.mockResolvedValue({
      upserted: 1,
      deactivated: 0,
      seen: 1,
    });
    syncReciters.mockResolvedValue({
      upserted: 1,
      deactivated: 0,
      seen: 1,
    });
  });

  it('fetches all catalogs then upserts mapped rows', async () => {
    const result = await service.syncAll();

    expect(getContent).toHaveBeenCalledTimes(3);
    expect(syncTranslations).toHaveBeenCalledWith([
      expect.objectContaining({ externalId: '20', languageCode: 'en' }),
    ]);
    expect(syncTafsirs).toHaveBeenCalledWith([
      expect.objectContaining({ externalId: '169' }),
    ]);
    expect(syncReciters).toHaveBeenCalledWith([
      expect.objectContaining({
        externalId: '7',
        name: 'Mishari Rashid al-`Afasy',
      }),
    ]);
    expect(result.translations.upserted).toBe(1);
  });

  it('does not write when upstream fetch fails', async () => {
    getContent.mockRejectedValue(new Error('QF unavailable'));

    await expect(service.syncAll()).rejects.toThrow('QF unavailable');
    expect(syncTranslations).not.toHaveBeenCalled();
    expect(syncTafsirs).not.toHaveBeenCalled();
    expect(syncReciters).not.toHaveBeenCalled();
  });

  it('refuses to sync when every list is empty', async () => {
    getContent.mockImplementation((path: string) => {
      if (path.includes('translations')) {
        return Promise.resolve({ translations: [] });
      }
      if (path.includes('tafsirs')) {
        return Promise.resolve({ tafsirs: [] });
      }
      return Promise.resolve({ recitations: [] });
    });

    await expect(service.syncAll()).rejects.toThrow(/all three resource lists/);
    expect(syncTranslations).not.toHaveBeenCalled();
  });
});
