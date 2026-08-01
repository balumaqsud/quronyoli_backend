import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class LanguageQueryDto {
  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string;
}

export class MushafPagesQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Mushaf ID (default 1 = Madani QCF V2)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mushaf?: number;
}

export class PaginationQueryDto extends LanguageQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number;
}

export class VersesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Comma-separated translation IDs' })
  @IsOptional()
  @IsString()
  translations?: string;

  @ApiPropertyOptional({ description: 'Comma-separated tafsir IDs' })
  @IsOptional()
  @IsString()
  tafsirs?: string;

  @ApiPropertyOptional({ description: 'Include word-by-word payload' })
  @IsOptional()
  @IsString()
  words?: string;

  @ApiPropertyOptional({ description: 'Ayah-by-ayah recitation ID' })
  @IsOptional()
  @IsString()
  audio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fields?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  word_fields?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  translation_fields?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tafsir_fields?: string;

  @ApiPropertyOptional({ description: 'Mushaf ID for page layout' })
  @IsOptional()
  @IsString()
  mushaf?: string;
}

export class PageLookupQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mushaf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(114)
  chapter_number?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  juz_number?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_number?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;
}

export class SearchQueryDto {
  @ApiProperty({ example: 'fatiha' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  query!: string;

  @ApiPropertyOptional({ enum: ['quick', 'advanced'], default: 'quick' })
  @IsOptional()
  @IsIn(['quick', 'advanced'])
  mode?: 'quick' | 'advanced';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  size?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  translation_ids?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  navigationalResultsNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  versesResultsNumber?: number;

  @ApiPropertyOptional({ description: 'Set to 1 for exact matches only' })
  @IsOptional()
  @IsString()
  exact_matches_only?: string;
}

export class AudioTimestampQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(114)
  chapter_number?: number;

  @ApiPropertyOptional({ example: '1:1' })
  @IsOptional()
  @IsString()
  verse_key?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  verse_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  word?: string;
}

export class ScriptQueryDto {
  @ApiPropertyOptional({ example: '1:1' })
  @IsOptional()
  @IsString()
  verse_key?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(114)
  chapter_number?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  juz_number?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_number?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  hizb_number?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rub_el_hizb_number?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ruku_number?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  manzil_number?: number;
}
