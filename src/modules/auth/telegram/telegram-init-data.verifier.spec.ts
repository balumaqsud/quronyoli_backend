import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { CONFIG_KEYS } from '../../../common/constants';
import { TelegramInitDataVerifier } from './telegram-init-data.verifier';

const BOT_TOKEN = '1234567890:TEST_TELEGRAM_BOT_TOKEN_VALUE_HERE';

const buildInitData = (
  overrides: Record<string, string> = {},
  options?: { omitHash?: boolean; invalidHash?: boolean },
): string => {
  const authDate = String(Math.floor(Date.now() / 1000));
  const user = JSON.stringify({
    id: 42,
    first_name: 'Ali',
    last_name: 'Valiyev',
    username: 'ali',
    language_code: 'uz',
  });

  const params = new URLSearchParams({
    auth_date: authDate,
    user,
    ...overrides,
  });

  if (!options?.omitHash) {
    const dataCheckString = [...params.entries()]
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();
    const hash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    params.set('hash', options?.invalidHash ? '00'.repeat(32) : hash);
  }

  return params.toString();
};

describe('TelegramInitDataVerifier', () => {
  let verifier: TelegramInitDataVerifier;

  beforeEach(() => {
    const configService = {
      getOrThrow: (key: string) => {
        if (key === CONFIG_KEYS.TELEGRAM) {
          return {
            botToken: BOT_TOKEN,
            initDataMaxAgeSeconds: 86400,
          };
        }

        throw new Error(`Unexpected config key: ${key}`);
      },
    } as unknown as ConfigService;

    verifier = new TelegramInitDataVerifier(configService);
  });

  it('verifies valid Telegram initData', () => {
    const result = verifier.verify(buildInitData());

    expect(result.user).toEqual(
      expect.objectContaining({
        id: 42,
        first_name: 'Ali',
        username: 'ali',
      }),
    );
  });

  it('verifies initData that includes query_id and signature', () => {
    const initData = buildInitData({
      query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
      signature: 'FAKE_ED25519_SIGNATURE_FOR_TEST',
    });

    expect([...new URLSearchParams(initData).keys()].sort()).toEqual([
      'auth_date',
      'hash',
      'query_id',
      'signature',
      'user',
    ]);

    const result = verifier.verify(initData);

    expect(result.user.id).toBe(42);
    expect(result.queryId).toBe('AAHdF6IQAAAAAN0XohDhrOrc');
  });

  it('rejects initData when signature is tampered with after hashing', () => {
    const params = new URLSearchParams(
      buildInitData({ signature: 'ORIGINAL_SIGNATURE' }),
    );
    params.set('signature', 'TAMPERED_SIGNATURE');

    expect(() => verifier.verify(params.toString())).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects invalid signatures', () => {
    expect(() =>
      verifier.verify(buildInitData({}, { invalidHash: true })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects expired initData', () => {
    const expiredAuthDate = String(Math.floor(Date.now() / 1000) - 90000);

    expect(() =>
      verifier.verify(buildInitData({ auth_date: expiredAuthDate })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects missing hash', () => {
    expect(() =>
      verifier.verify(buildInitData({}, { omitHash: true })),
    ).toThrow(UnauthorizedException);
  });
});
