import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosHeaders } from 'axios';
import { CONFIG_KEYS } from '../../../common/constants';
import { QuranEncClient } from './quranenc.client';

describe('QuranEncClient', () => {
  const httpService = {
    request: jest.fn(),
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue({
      apiBaseUrl: 'https://quranenc.com/api/v1',
      timeoutMs: 5000,
      maxRetries: 0,
      retryBaseDelayMs: 10,
    }),
  };
  const logger = {
    warn: jest.fn(),
    setContext: jest.fn(),
  };

  let client: QuranEncClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new QuranEncClient(
      httpService as unknown as HttpService,
      configService as unknown as ConfigService,
      logger as never,
    );
  });

  it('fetches and parses a surah translation', async () => {
    httpService.request.mockReturnValue(
      of({
        data: {
          result: [
            {
              sura: '1',
              aya: '1',
              translation: 'Ырайымдуу',
              footnotes: '',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );

    await expect(
      client.getSurahTranslation('kyrgyz_hakimov', 1),
    ).resolves.toEqual([
      {
        sura: 1,
        aya: 1,
        translation: 'Ырайымдуу',
        footnotes: '',
      },
    ]);
    expect(httpService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://quranenc.com/api/v1/translation/sura/kyrgyz_hakimov/1',
      }),
    );
  });

  it('rejects non-allowlisted keys and invalid surah', async () => {
    await expect(
      client.getSurahTranslation('evil' as never, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      client.getSurahTranslation('kyrgyz_hakimov', 0),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps 404 to NotFoundException', async () => {
    const error = new AxiosError('Not found');
    error.response = {
      status: 404,
      statusText: 'Not Found',
      data: {},
      headers: {},
      config: { headers: new AxiosHeaders() },
    };
    error.isAxiosError = true;
    httpService.request.mockReturnValue(throwError(() => error));

    await expect(
      client.getAyahTranslation('kyrgyz_hakimov', 1, 1),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reads CONFIG_KEYS.QURANENC', () => {
    expect(configService.getOrThrow).toHaveBeenCalledWith(CONFIG_KEYS.QURANENC);
  });
});
