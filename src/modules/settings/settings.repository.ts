import { Injectable } from '@nestjs/common';
import {
  QuranReciter,
  QuranTafsir,
  QuranTranslation,
  Prisma,
} from '../../generated/prisma';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  DEFAULT_AYAT_REMINDER_LOCAL_TIME,
  QURAN_FOUNDATION_PROVIDER,
  SettingsUpdateData,
  SettingsWithCatalog,
} from './interfaces/settings.interface';

const translationSelect = {
  id: true,
  provider: true,
  externalId: true,
  languageCode: true,
  name: true,
  authorName: true,
  slug: true,
  isActive: true,
  isDefault: true,
  sortOrder: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.QuranTranslationSelect;

const tafsirSelect = {
  id: true,
  provider: true,
  externalId: true,
  languageCode: true,
  name: true,
  authorName: true,
  slug: true,
  isActive: true,
  sortOrder: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.QuranTafsirSelect;

const reciterSelect = {
  id: true,
  provider: true,
  externalId: true,
  kind: true,
  name: true,
  arabicName: true,
  style: true,
  slug: true,
  isActive: true,
  isPopular: true,
  sortOrder: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.QuranReciterSelect;

const settingsInclude = {
  defaultTranslation: { select: translationSelect },
  defaultTafsir: { select: tafsirSelect },
  defaultReciter: { select: reciterSelect },
  defaultChapterReciter: { select: reciterSelect },
} satisfies Prisma.UserSettingsInclude;

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<SettingsWithCatalog | null> {
    return await this.prisma.userSettings.findUnique({
      where: { userId },
      include: settingsInclude,
    });
  }

  async upsertDefaults(userId: string): Promise<SettingsWithCatalog> {
    return await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: settingsInclude,
    });
  }

  async upsertWithUpdate(
    userId: string,
    data: SettingsUpdateData,
  ): Promise<SettingsWithCatalog> {
    return await this.prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: data,
      include: settingsInclude,
    });
  }

  /**
   * Sync TelegramReminderPreference with Settings ayatRemindersEnabled.
   * Preserves existing localTime when present; otherwise defaults to 07:00.
   */
  async syncReminderPreferenceFromSettings(input: {
    userId: string;
    enabled: boolean;
  }): Promise<void> {
    const existing = await this.prisma.telegramReminderPreference.findUnique({
      where: { userId: input.userId },
      select: { localTime: true },
    });

    await this.prisma.telegramReminderPreference.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        enabled: input.enabled,
        localTime: DEFAULT_AYAT_REMINDER_LOCAL_TIME,
      },
      update: {
        enabled: input.enabled,
        localTime: existing?.localTime ?? DEFAULT_AYAT_REMINDER_LOCAL_TIME,
      },
    });
  }

  async setAyatRemindersEnabled(
    userId: string,
    enabled: boolean,
  ): Promise<void> {
    await this.prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        ayatRemindersEnabled: enabled,
      },
      update: {
        ayatRemindersEnabled: enabled,
      },
    });
  }

  async markLastAyatReminderAt(userId: string, at: Date): Promise<void> {
    await this.prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        lastAyatReminderAt: at,
      },
      update: {
        lastAyatReminderAt: at,
      },
    });
  }

  async findActiveTranslationByExternalId(
    externalId: string,
  ): Promise<QuranTranslation | null> {
    return await this.prisma.quranTranslation.findFirst({
      where: {
        externalId,
        isActive: true,
        deletedAt: null,
      },
    });
  }

  async findActiveTafsirByExternalId(
    externalId: string,
  ): Promise<QuranTafsir | null> {
    return await this.prisma.quranTafsir.findFirst({
      where: {
        provider: QURAN_FOUNDATION_PROVIDER,
        externalId,
        isActive: true,
        deletedAt: null,
      },
    });
  }

  async findActiveReciterByExternalId(
    externalId: string,
  ): Promise<QuranReciter | null> {
    return await this.prisma.quranReciter.findFirst({
      where: {
        provider: QURAN_FOUNDATION_PROVIDER,
        externalId,
        kind: 'AYAH',
        isActive: true,
        deletedAt: null,
      },
    });
  }

  async findActiveChapterReciterByExternalId(
    externalId: string,
  ): Promise<QuranReciter | null> {
    return await this.prisma.quranReciter.findFirst({
      where: {
        provider: QURAN_FOUNDATION_PROVIDER,
        externalId,
        kind: 'CHAPTER',
        isActive: true,
        deletedAt: null,
      },
    });
  }

  async findDefaultActiveTranslation(): Promise<QuranTranslation | null> {
    return await this.prisma.quranTranslation.findFirst({
      where: {
        isActive: true,
        isDefault: true,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findFirstActiveTranslationByLanguage(
    languageCode: string,
  ): Promise<QuranTranslation | null> {
    return await this.prisma.quranTranslation.findFirst({
      where: {
        languageCode,
        isActive: true,
        deletedAt: null,
      },
      orderBy: [
        { isDefault: 'desc' },
        { sortOrder: 'asc' },
        { externalId: 'asc' },
      ],
    });
  }

  async findFirstActiveTafsirByLanguage(
    languageCode: string,
  ): Promise<QuranTafsir | null> {
    return await this.prisma.quranTafsir.findFirst({
      where: {
        provider: QURAN_FOUNDATION_PROVIDER,
        languageCode,
        isActive: true,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { externalId: 'asc' }],
    });
  }
}
