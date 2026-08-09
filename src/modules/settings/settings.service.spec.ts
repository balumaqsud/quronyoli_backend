import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThemePreference } from '../../generated/prisma';
import { UsersService } from '../users/users.service';
import { AnalyticsTrackingService } from '../analytics/analytics-tracking.service';
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
      | 'syncReminderPreferenceFromSettings'
      | 'setAyatRemindersEnabled'
      | 'markLastAyatReminderAt'
      | 'findActiveTranslationByExternalId'
      | 'findActiveTafsirByExternalId'
      | 'findActiveReciterByExternalId'
      | 'findActiveChapterReciterByExternalId'
      | 'findDefaultActiveTranslation'
      | 'findFirstActiveTranslationByLanguage'
      | 'findFirstActiveTafsirByLanguage'
    >
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'getActiveByIdOrThrow'>>;
  let analyticsTracking: jest.Mocked<Pick<AnalyticsTrackingService, 'track'>>;

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
    ayatRemindersEnabled: false,
    lastAyatReminderAt: null,
    defaultTranslationId: null,
    defaultTafsirId: null,
    defaultReciterId: null,
    defaultChapterReciterId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    defaultTranslation: null,
    defaultTafsir: null,
    defaultReciter: null,
    defaultChapterReciter: null,
  };

  beforeEach(async () => {
    repository = {
      upsertDefaults: jest.fn().mockResolvedValue(baseSettings),
      upsertWithUpdate: jest.fn(),
      syncReminderPreferenceFromSettings: jest
        .fn()
        .mockResolvedValue(undefined),
      setAyatRemindersEnabled: jest.fn().mockResolvedValue(undefined),
      markLastAyatReminderAt: jest.fn().mockResolvedValue(undefined),
      findActiveTranslationByExternalId: jest.fn(),
      findActiveTafsirByExternalId: jest.fn(),
      findActiveReciterByExternalId: jest.fn(),
      findActiveChapterReciterByExternalId: jest.fn(),
      findDefaultActiveTranslation: jest.fn(),
      findFirstActiveTranslationByLanguage: jest.fn(),
      findFirstActiveTafsirByLanguage: jest.fn(),
    };
    usersService = {
      getActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    analyticsTracking = {
      track: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: SettingsRepository, useValue: repository },
        { provide: UsersService, useValue: usersService },
        { provide: AnalyticsTrackingService, useValue: analyticsTracking },
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
      ayatRemindersEnabled: false,
      lastAyatReminderAt: null,
      translation: null,
      tafsir: null,
      reciter: null,
      chapterReciter: null,
    });

    expect(usersService.getActiveByIdOrThrow).toHaveBeenCalledWith('user-1');
    expect(repository.upsertDefaults).toHaveBeenCalledWith('user-1');
  });

  it('enables ayat reminders and syncs Telegram preference', async () => {
    repository.upsertWithUpdate.mockResolvedValue({
      ...baseSettings,
      ayatRemindersEnabled: true,
    });

    const result = await service.updateForUser('user-1', {
      ayatRemindersEnabled: true,
    });

    expect(repository.upsertWithUpdate).toHaveBeenCalledWith('user-1', {
      ayatRemindersEnabled: true,
    });
    expect(repository.syncReminderPreferenceFromSettings).toHaveBeenCalledWith({
      userId: 'user-1',
      enabled: true,
    });
    expect(result.ayatRemindersEnabled).toBe(true);
  });

  it('disables ayat reminders for /stop and blocked chats', async () => {
    await service.disableAyatReminders('user-1');

    expect(repository.setAyatRemindersEnabled).toHaveBeenCalledWith(
      'user-1',
      false,
    );
    expect(repository.syncReminderPreferenceFromSettings).toHaveBeenCalledWith({
      userId: 'user-1',
      enabled: false,
    });
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
        isDefault: false,
        sortOrder: 0,
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
      isDefault: false,
      sortOrder: 0,
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
        isDefault: false,
        sortOrder: 0,
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
    expect(analyticsTracking.track).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        eventName: 'TRANSLATION_CHANGE',
      }),
    );
  });

  it('resolves QuranEnc Kyrgyz string translation id', async () => {
    repository.findActiveTranslationByExternalId.mockResolvedValue({
      id: 'uuid-ky',
      provider: 'quranenc',
      externalId: 'kyrgyz_hakimov',
      languageCode: 'ky',
      name: 'Kyrgyz — Shamsuddin Hakimov',
      authorName: 'Shamsuddin Hakimov',
      slug: 'kyrgyz_hakimov',
      isActive: true,
      isDefault: false,
      sortOrder: 0,
      metadata: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repository.upsertWithUpdate.mockResolvedValue({
      ...baseSettings,
      defaultTranslationId: 'uuid-ky',
      defaultTranslation: {
        id: 'uuid-ky',
        provider: 'quranenc',
        externalId: 'kyrgyz_hakimov',
        languageCode: 'ky',
        name: 'Kyrgyz — Shamsuddin Hakimov',
        authorName: 'Shamsuddin Hakimov',
        slug: 'kyrgyz_hakimov',
        isActive: true,
        isDefault: false,
        sortOrder: 0,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await service.updateForUser('user-1', {
      translationId: 'kyrgyz_hakimov',
    });

    expect(repository.findActiveTranslationByExternalId).toHaveBeenCalledWith(
      'kyrgyz_hakimov',
    );
    expect(repository.upsertWithUpdate).toHaveBeenCalledWith('user-1', {
      defaultTranslationId: 'uuid-ky',
    });
    expect(result.translation?.id).toBe('kyrgyz_hakimov');
    expect(result.translation?.languageCode).toBe('ky');
  });

  it('clears resource selections when null is provided', async () => {
    repository.upsertWithUpdate.mockResolvedValue(baseSettings);

    await service.updateForUser('user-1', {
      translationId: null,
      tafsirId: null,
      reciterId: null,
      chapterReciterId: null,
    });

    expect(repository.upsertWithUpdate).toHaveBeenCalledWith('user-1', {
      defaultTranslationId: null,
      defaultTafsirId: null,
      defaultReciterId: null,
      defaultChapterReciterId: null,
    });
    expect(repository.findActiveTranslationByExternalId).not.toHaveBeenCalled();
  });

  it('rejects ayah reciter IDs used as chapterReciterId', async () => {
    repository.findActiveChapterReciterByExternalId.mockResolvedValue(null);

    await expect(
      service.updateForUser('user-1', { chapterReciterId: '7' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      repository.findActiveChapterReciterByExternalId,
    ).toHaveBeenCalledWith('7');
    expect(repository.upsertWithUpdate).not.toHaveBeenCalled();
  });

  it('rejects chapter reciter IDs used as reciterId', async () => {
    repository.findActiveReciterByExternalId.mockResolvedValue(null);

    await expect(
      service.updateForUser('user-1', { reciterId: '1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findActiveReciterByExternalId).toHaveBeenCalledWith('1');
    expect(repository.upsertWithUpdate).not.toHaveBeenCalled();
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

  it('prefers admin default translation for bot content prefs', async () => {
    repository.findDefaultActiveTranslation.mockResolvedValue({
      id: 'uuid-default',
      provider: 'quran.foundation',
      externalId: '85',
      languageCode: 'uz',
      name: 'Default Uz',
      authorName: null,
      slug: null,
      isActive: true,
      isDefault: true,
      sortOrder: 0,
      metadata: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repository.findFirstActiveTafsirByLanguage.mockResolvedValue(null);

    await expect(service.getBotContentPrefs('user-1')).resolves.toEqual({
      timezone: 'Asia/Tashkent',
      translationExternalId: '85',
      tafsirExternalId: null,
      reciterExternalId: null,
    });

    expect(repository.findDefaultActiveTranslation).toHaveBeenCalled();
    expect(
      repository.findFirstActiveTranslationByLanguage,
    ).not.toHaveBeenCalled();
  });
});
