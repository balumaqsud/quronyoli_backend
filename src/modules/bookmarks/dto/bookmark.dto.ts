import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { KeysetPaginationQueryDto } from '../../../common/pagination/keyset-pagination.dto';

export class CreateBookmarkDto {
  @ApiProperty({ example: 2, minimum: 1, maximum: 114 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(114)
  chapterNumber!: number;

  @ApiProperty({ example: 255, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  verseNumber!: number;

  @ApiPropertyOptional({ example: 1, nullable: true, minimum: 1 })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  wordNumber?: number | null;

  @ApiPropertyOptional({ example: 1200, nullable: true, minimum: 0 })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  audioOffsetMs?: number | null;

  @ApiPropertyOptional({
    example: 'Ayat al-Kursi',
    nullable: true,
    maxLength: 120,
  })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MaxLength(120)
  label?: string | null;

  @ApiPropertyOptional({
    example: 'Memorize this ayah',
    nullable: true,
    maxLength: 2000,
  })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @ApiPropertyOptional({
    example: '#2F6B4F',
    nullable: true,
    maxLength: 32,
  })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MaxLength(32)
  @Matches(/^#[0-9A-Fa-f]{3,8}$|^[A-Za-z0-9_-]{1,32}$/, {
    message: 'color must be a hex code or short token',
  })
  color?: string | null;
}

export class UpdateBookmarkDto {
  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 114 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(114)
  chapterNumber?: number;

  @ApiPropertyOptional({ example: 255, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  verseNumber?: number;

  @ApiPropertyOptional({ example: 1, nullable: true, minimum: 1 })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  wordNumber?: number | null;

  @ApiPropertyOptional({ example: 1200, nullable: true, minimum: 0 })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  audioOffsetMs?: number | null;

  @ApiPropertyOptional({
    example: 'Ayat al-Kursi',
    nullable: true,
    maxLength: 120,
  })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MaxLength(120)
  label?: string | null;

  @ApiPropertyOptional({
    example: 'Memorize this ayah',
    nullable: true,
    maxLength: 2000,
  })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @ApiPropertyOptional({
    example: '#2F6B4F',
    nullable: true,
    maxLength: 32,
  })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MaxLength(32)
  @Matches(/^#[0-9A-Fa-f]{3,8}$|^[A-Za-z0-9_-]{1,32}$/, {
    message: 'color must be a hex code or short token',
  })
  color?: string | null;
}

export class ListBookmarksQueryDto extends KeysetPaginationQueryDto {
  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 114 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(114)
  chapterNumber?: number;

  @ApiPropertyOptional({
    example: 255,
    description: 'Requires chapterNumber',
    minimum: 1,
  })
  @ValidateIf((dto: ListBookmarksQueryDto) => dto.verseNumber !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  verseNumber?: number;

  @ApiPropertyOptional({ example: '#2F6B4F', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;

  @ApiPropertyOptional({
    description: 'Inclusive lower bound for createdAt',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive upper bound for createdAt',
    example: '2026-07-30',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
