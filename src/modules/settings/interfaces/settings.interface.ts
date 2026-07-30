import {
  QuranReciter,
  QuranTafsir,
  QuranTranslation,
  ThemePreference,
  UserSettings,
} from '../../../generated/prisma';
import { UpdateSettingsDto } from '../dto/update-settings.dto';

export const QURAN_FOUNDATION_PROVIDER = 'quran.foundation';

export type SettingsWithCatalog = UserSettings & {
  defaultTranslation: QuranTranslation | null;
  defaultTafsir: QuranTafsir | null;
  defaultReciter: QuranReciter | null;
};

export interface ResolvedCatalogIds {
  defaultTranslationId?: string | null;
  defaultTafsirId?: string | null;
  defaultReciterId?: string | null;
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
}

export type UpdateSettingsInput = UpdateSettingsDto;
