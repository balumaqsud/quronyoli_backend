import { BadRequestException, Injectable } from '@nestjs/common';
import {
  QuranReciter,
  QuranTafsir,
  QuranTranslation,
} from '../../generated/prisma';
import { UsersService } from '../users/users.service';
import { AnalyticsTrackingService } from '../analytics/analytics-tracking.service';
import {
  CatalogResourceDto,
  SettingsResponseDto,
} from './dto/settings-response.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  SettingsUpdateData,
  SettingsWithCatalog,
} from './interfaces/settings.interface';
import { SettingsRepository } from './settings.repository';

@Injectable()
export class SettingsService {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly usersService: UsersService,
    private readonly analyticsTracking: AnalyticsTrackingService,
  ) {}

  async getForUser(userId: string): Promise<SettingsResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const settings = await this.settingsRepository.upsertDefaults(userId);
    return this.toResponse(settings);
  }

  async updateForUser(
    userId: string,
    dto: UpdateSettingsDto,
  ): Promise<SettingsResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const previous = await this.settingsRepository.upsertDefaults(userId);
    const data = await this.buildUpdateData(dto);
    const settings = await this.settingsRepository.upsertWithUpdate(
      userId,
      data,
    );

    if (
      data.defaultTranslationId !== undefined &&
      data.defaultTranslationId !== previous.defaultTranslationId
    ) {
      await this.analyticsTracking.track({
        userId,
        eventName: 'TRANSLATION_CHANGE',
        properties: {
          translationId: data.defaultTranslationId,
          previousTranslationId: previous.defaultTranslationId,
          source: 'settings',
        },
      });
    }

    return this.toResponse(settings);
  }

  toResponse(settings: SettingsWithCatalog): SettingsResponseDto {
    return {
      locale: settings.locale,
      timezone: settings.timezone,
      theme: settings.theme,
      arabicFontSize: settings.arabicFontSize,
      translationFontSize: settings.translationFontSize,
      playbackRate: settings.playbackRate,
      autoPlayNext: settings.autoPlayNext,
      repeatVerse: settings.repeatVerse,
      translation: this.mapTranslation(settings.defaultTranslation),
      tafsir: this.mapTafsir(settings.defaultTafsir),
      reciter: this.mapReciter(settings.defaultReciter),
      chapterReciter: this.mapReciter(settings.defaultChapterReciter),
      updatedAt: settings.updatedAt,
    };
  }

  private async buildUpdateData(
    dto: UpdateSettingsDto,
  ): Promise<SettingsUpdateData> {
    const data: SettingsUpdateData = {};

    if (dto.locale !== undefined) {
      data.locale = dto.locale;
    }
    if (dto.timezone !== undefined) {
      data.timezone = dto.timezone;
    }
    if (dto.theme !== undefined) {
      data.theme = dto.theme;
    }
    if (dto.arabicFontSize !== undefined) {
      data.arabicFontSize = dto.arabicFontSize;
    }
    if (dto.translationFontSize !== undefined) {
      data.translationFontSize = dto.translationFontSize;
    }
    if (dto.playbackRate !== undefined) {
      data.playbackRate = dto.playbackRate;
    }
    if (dto.autoPlayNext !== undefined) {
      data.autoPlayNext = dto.autoPlayNext;
    }
    if (dto.repeatVerse !== undefined) {
      data.repeatVerse = dto.repeatVerse;
    }

    if (dto.translationId !== undefined) {
      data.defaultTranslationId = await this.resolveTranslationId(
        dto.translationId,
      );
    }
    if (dto.tafsirId !== undefined) {
      data.defaultTafsirId = await this.resolveTafsirId(dto.tafsirId);
    }
    if (dto.reciterId !== undefined) {
      data.defaultReciterId = await this.resolveReciterId(dto.reciterId);
    }
    if (dto.chapterReciterId !== undefined) {
      data.defaultChapterReciterId = await this.resolveChapterReciterId(
        dto.chapterReciterId,
      );
    }

    return data;
  }

  private async resolveTranslationId(
    externalId: string | null,
  ): Promise<string | null> {
    if (externalId === null) {
      return null;
    }

    const resource =
      await this.settingsRepository.findActiveTranslationByExternalId(
        externalId,
      );
    if (!resource) {
      throw new BadRequestException(
        `Unknown or inactive Quran translation resource: ${externalId}`,
      );
    }

    return resource.id;
  }

  private async resolveTafsirId(
    externalId: string | null,
  ): Promise<string | null> {
    if (externalId === null) {
      return null;
    }

    const resource =
      await this.settingsRepository.findActiveTafsirByExternalId(externalId);
    if (!resource) {
      throw new BadRequestException(
        `Unknown or inactive Quran tafsir resource: ${externalId}`,
      );
    }

    return resource.id;
  }

  private async resolveReciterId(
    externalId: string | null,
  ): Promise<string | null> {
    if (externalId === null) {
      return null;
    }

    const resource =
      await this.settingsRepository.findActiveReciterByExternalId(externalId);
    if (!resource) {
      throw new BadRequestException(
        `Unknown or inactive Quran ayah reciter resource: ${externalId}`,
      );
    }

    return resource.id;
  }

  private async resolveChapterReciterId(
    externalId: string | null,
  ): Promise<string | null> {
    if (externalId === null) {
      return null;
    }

    const resource =
      await this.settingsRepository.findActiveChapterReciterByExternalId(
        externalId,
      );
    if (!resource) {
      throw new BadRequestException(
        `Unknown or inactive Quran chapter reciter resource: ${externalId}`,
      );
    }

    return resource.id;
  }

  private mapTranslation(
    resource: Omit<QuranTranslation, 'metadata'> | null,
  ): CatalogResourceDto | null {
    if (!resource) {
      return null;
    }

    return {
      id: resource.externalId,
      name: resource.name,
      authorName: resource.authorName,
      languageCode: resource.languageCode,
    };
  }

  private mapTafsir(
    resource: Omit<QuranTafsir, 'metadata'> | null,
  ): CatalogResourceDto | null {
    if (!resource) {
      return null;
    }

    return {
      id: resource.externalId,
      name: resource.name,
      authorName: resource.authorName,
      languageCode: resource.languageCode,
    };
  }

  private mapReciter(
    resource: Omit<QuranReciter, 'metadata'> | null,
  ): CatalogResourceDto | null {
    if (!resource) {
      return null;
    }

    return {
      id: resource.externalId,
      name: resource.name,
      authorName: null,
      arabicName: resource.arabicName,
      style: resource.style,
    };
  }
}
