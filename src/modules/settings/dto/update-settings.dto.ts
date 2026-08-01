import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ThemePreference } from '../../../generated/prisma';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: 'App UI language / locale (BCP 47-like tag)',
    example: 'uz',
    maxLength: 16,
  })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  @Matches(/^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})?$/, {
    message: 'locale must be a short language tag such as uz, en, or uz-Latn',
  })
  locale?: string;

  @ApiPropertyOptional({
    description: 'IANA timezone identifier',
    example: 'Asia/Tashkent',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    enum: ThemePreference,
    example: ThemePreference.SYSTEM,
  })
  @IsOptional()
  @IsEnum(ThemePreference)
  theme?: ThemePreference;

  @ApiPropertyOptional({
    description: 'Arabic text font size in px',
    example: 24,
    minimum: 12,
    maximum: 64,
  })
  @IsOptional()
  @IsInt()
  @Min(12)
  @Max(64)
  arabicFontSize?: number;

  @ApiPropertyOptional({
    description: 'Translation text font size in px',
    example: 16,
    minimum: 10,
    maximum: 48,
  })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(48)
  translationFontSize?: number;

  @ApiPropertyOptional({
    description: 'Audio playback rate multiplier',
    example: 1,
    minimum: 0.5,
    maximum: 2,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(2)
  playbackRate?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  autoPlayNext?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  repeatVerse?: boolean;

  @ApiPropertyOptional({
    description:
      'Quran.Foundation translation resource ID. Pass null to clear.',
    example: '131',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MaxLength(128)
  translationId?: string | null;

  @ApiPropertyOptional({
    description: 'Quran.Foundation tafsir resource ID. Pass null to clear.',
    example: '169',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MaxLength(128)
  tafsirId?: string | null;

  @ApiPropertyOptional({
    description:
      'Quran.Foundation ayah-by-ayah recitation resource ID. Pass null to clear.',
    example: '7',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MaxLength(128)
  reciterId?: string | null;

  @ApiPropertyOptional({
    description:
      'Quran.Foundation chapter reciter resource ID. Pass null to clear.',
    example: '7',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MaxLength(128)
  chapterReciterId?: string | null;
}
