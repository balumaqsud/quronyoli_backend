import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThemePreference } from '../../generated/prisma';
import { UsersService } from '../users/users.service';
import { SettingsWithCatalog } from './interfaces/settings.interface';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let repository: jest.Mocked<
    Pick<
      SettingsRepository,
      | 'upsertDefaults'
      | 'upsertWithUpdate'
      | 'findActiveTranslationByExternalId'
      | 'findActiveTafsirByExternalId'
      | 'findActiveReciterByExternalId'
    >
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'getActiveByIdOrThrow'>>;

  const baseSettings: SettingsWithCatalog = {
    userId: 'user-1',
    locale: 'uz',
    timezone: 'Asia/Tashkent',
    theme: ThemePreference.SYSTEM,
    arabicFontSize: 24,
    translationFontSize: 16,
    playbackRate: 1,
    autoPlayNext: false,
    repeatVerse: false,
    defaultTranslationId: null,
    defaultTafsirId: null,
    defaultReciterId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    defaultTranslation: null,
    defaultTafsir: null,
    defaultReciter: null,
  };

  beforeEach(async () => {
    repository = {
      upsertDefaults: jest.fn(),
      upsertWithUpdate: jest.fn(),
      findActiveTranslationByExternalId: jest.fn(),
      findActiveTafsirByExternalId: jest.fn(),
      findActiveReciterByExternalId: jest.fn(),
    };
    usersService = {
      getActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: SettingsRepository, useValue: repository },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(SettingsService);
  });

  it('creates default settings on get', async () => {
    repository.upsertDefaults.mockResolvedValue(baseSettings);

    await expect(service.getForUser('user-1')).resolves.toMatchObject({
      locale: 'uz',
      theme: ThemePreference.SYSTEM,
      arabicFontSize: 24,
      translation: null,
      tafsir: null,
      reciter: null,
    });

    expect(usersService.getActiveByIdOrThrow).toHaveBeenCalledWith('user-1');
    expect(repository.upsertDefaults).toHaveBeenCalledWith('user-1');
  });

  it('maps catalog resources to Quran.Foundation external IDs', () => {
    const settings: SettingsWithCatalog = {
      ...baseSettings,
      defaultTranslationId: 'uuid-translation',
      defaultTranslation: {
        id: 'uuid-translation',
        provider: 'quran.foundation',
        externalId: '131',
        languageCode: 'en',
        name: 'Clear Quran',
        authorName: 'Dr. Mustafa Khattab',
        slug: 'clear-quran',
        isActive: true,
        metadata: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      defaultTafsir: null,
      defaultReciter: null,
    };

    expect(service.toResponse(settings).translation).toEqual({
      id: '131',
      name: 'Clear Quran',
      authorName: 'Dr. Mustafa Khattab',
      languageCode: 'en',
    });
  });

  it('applies partial updates and resolves external catalog IDs', async () => {
    repository.findActiveTranslationByExternalId.mockResolvedValue({
      id: 'uuid-translation',
      provider: 'quran.foundation',
      externalId: '131',
      languageCode: 'en',
      name: 'Clear Quran',
      authorName: 'Dr. Mustafa Khattab',
      slug: null,
      isActive: true,
      metadata: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repository.upsertWithUpdate.mockResolvedValue({
      ...baseSettings,
      theme: ThemePreference.DARK,
      defaultTranslationId: 'uuid-translation',
      defaultTranslation: {
        id: 'uuid-translation',
        provider: 'quran.foundation',
        externalId: '131',
        languageCode: 'en',
        name: 'Clear Quran',
        authorName: 'Dr. Mustafa Khattab',
        slug: null,
        isActive: true,
        metadata: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await service.updateForUser('user-1', {
      theme: ThemePreference.DARK,
      translationId: '131',
    });

    expect(repository.upsertWithUpdate).toHaveBeenCalledWith('user-1', {
      theme: ThemePreference.DARK,
      defaultTranslationId: 'uuid-translation',
    });
    expect(result.theme).toBe(ThemePreference.DARK);
    expect(result.translation?.id).toBe('131');
  });

  it('clears resource selections when null is provided', async () => {
    repository.upsertWithUpdate.mockResolvedValue(baseSettings);

    await service.updateForUser('user-1', {
      translationId: null,
      tafsirId: null,
      reciterId: null,
    });

    expect(repository.upsertWithUpdate).toHaveBeenCalledWith('user-1', {
      defaultTranslationId: null,
      defaultTafsirId: null,
      defaultReciterId: null,
    });
    expect(repository.findActiveTranslationByExternalId).not.toHaveBeenCalled();
  });

  it('rejects unknown translation resource IDs', async () => {
    repository.findActiveTranslationByExternalId.mockResolvedValue(null);

    await expect(
      service.updateForUser('user-1', { translationId: '999' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.upsertWithUpdate).not.toHaveBeenCalled();
  });

  it('rejects updates for inactive users', async () => {
    usersService.getActiveByIdOrThrow.mockRejectedValue(
      new UnauthorizedException('User not found or inactive'),
    );

    await expect(service.getForUser('missing')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
