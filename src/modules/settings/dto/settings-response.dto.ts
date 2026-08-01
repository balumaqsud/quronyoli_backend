import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ThemePreference } from '../../../generated/prisma';

export class CatalogResourceDto {
  @ApiProperty({
    description: 'Quran.Foundation external resource ID',
    example: '131',
  })
  id!: string;

  @ApiProperty({ example: 'Dr. Mustafa Khattab' })
  name!: string;

  @ApiPropertyOptional({ example: 'Clear Quran', nullable: true })
  authorName!: string | null;

  @ApiPropertyOptional({ example: 'en', nullable: true })
  languageCode?: string | null;

  @ApiPropertyOptional({ example: 'murattal', nullable: true })
  style?: string | null;

  @ApiPropertyOptional({ example: 'عبد الباسط عبد الصمد', nullable: true })
  arabicName?: string | null;
}

export class SettingsResponseDto {
  @ApiProperty({ example: 'uz', description: 'App UI language / locale' })
  locale!: string;

  @ApiProperty({ example: 'Asia/Tashkent' })
  timezone!: string;

  @ApiProperty({ enum: ThemePreference, example: ThemePreference.SYSTEM })
  theme!: ThemePreference;

  @ApiProperty({ example: 24, description: 'Arabic text font size in px' })
  arabicFontSize!: number;

  @ApiProperty({ example: 16, description: 'Translation text font size in px' })
  translationFontSize!: number;

  @ApiProperty({ example: 1, description: 'Audio playback rate multiplier' })
  playbackRate!: number;

  @ApiProperty({ example: false })
  autoPlayNext!: boolean;

  @ApiProperty({ example: false })
  repeatVerse!: boolean;

  @ApiPropertyOptional({
    type: CatalogResourceDto,
    nullable: true,
    description: 'Default Quran translation (Quran.Foundation resource)',
  })
  translation!: CatalogResourceDto | null;

  @ApiPropertyOptional({
    type: CatalogResourceDto,
    nullable: true,
    description: 'Default tafsir (Quran.Foundation resource)',
  })
  tafsir!: CatalogResourceDto | null;

  @ApiPropertyOptional({
    type: CatalogResourceDto,
    nullable: true,
    description:
      'Default ayah-by-ayah reciter (Quran.Foundation /resources/recitations)',
  })
  reciter!: CatalogResourceDto | null;

  @ApiPropertyOptional({
    type: CatalogResourceDto,
    nullable: true,
    description:
      'Default chapter reciter (Quran.Foundation /resources/chapter_reciters)',
  })
  chapterReciter!: CatalogResourceDto | null;

  @ApiProperty()
  updatedAt!: Date;
}
