import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { KeysetPaginationQueryDto } from '../../../common/pagination/keyset-pagination.dto';

export class CreateFavoriteDto {
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
}

export class UpdateFavoriteDto {
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
}

export class ListFavoritesQueryDto extends KeysetPaginationQueryDto {
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
  @ValidateIf((dto: ListFavoritesQueryDto) => dto.verseNumber !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  verseNumber?: number;
}
