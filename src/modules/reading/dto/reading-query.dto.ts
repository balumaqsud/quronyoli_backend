import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ReadingPaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Keyset cursor from a previous page',
    example: 'eyJhdCI6IjIwMjYtMDctMzBUMDA6MDA6MDAuMDAwWiIsImlkIjoiLi4uIn0',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Page size',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ReadingHistoryQueryDto extends ReadingPaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Inclusive lower bound (ISO date or datetime)',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive upper bound (ISO date or datetime)',
    example: '2026-07-30',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ReadingDailyQueryDto {
  @ApiProperty({
    description: 'Inclusive start date (YYYY-MM-DD)',
    example: '2026-07-01',
  })
  @IsDateString()
  from!: string;

  @ApiProperty({
    description: 'Inclusive end date (YYYY-MM-DD)',
    example: '2026-07-30',
  })
  @IsDateString()
  to!: string;
}
