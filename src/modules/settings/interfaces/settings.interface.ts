import {
  QuranReciter,
  QuranTafsir,
  QuranTranslation,
  ThemePreference,
  UserSettings,
} from '../../../generated/prisma';
import { UpdateSettingsDto } from '../dto/update-settings.dto';

export const QURAN_FOUNDATION_PROVIDER = 'quran.foundation';
export const QURANENC_PROVIDER = 'quranenc';

export type SettingsWithCatalog = UserSettings & {
  defaultTranslation: Omit<QuranTranslation, 'metadata'> | null;
  defaultTafsir: Omit<QuranTafsir, 'metadata'> | null;
  defaultReciter: Omit<QuranReciter, 'metadata'> | null;
  defaultChapterReciter: Omit<QuranReciter, 'metadata'> | null;
};

export interface ResolvedCatalogIds {
  defaultTranslationId?: string | null;
  defaultTafsirId?: string | null;
  defaultReciterId?: string | null;
  defaultChapterReciterId?: string | null;
}

export interface SettingsUpdateData extends ResolvedCatalogIds {
  locale?: string;
  timezone?: string;
  theme?: ThemePreference;
  arabicFontSize?: number;
  translationFontSize?: number;
  playbackRate?: number;
  autoPlayNext?: boolean;
  repeatVerse?: boolean;
  ayatRemindersEnabled?: boolean;
  lastAyatReminderAt?: Date | null;
}

/** Default local send window when enabling ayat reminders via Settings. */
export const DEFAULT_AYAT_REMINDER_LOCAL_TIME = '07:00';

/** Minimum gap between Telegram ayat reminders per user. */
export const AYAT_REMINDER_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000;

export type UpdateSettingsInput = UpdateSettingsDto;
