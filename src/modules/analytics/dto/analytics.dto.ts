import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ANALYTICS_EVENT_NAMES } from '../analytics.constants';

export class AnalyticsEventDto {
  @ApiProperty({ enum: ANALYTICS_EVENT_NAMES, example: 'APP_OPEN' })
  @IsEnum(ANALYTICS_EVENT_NAMES)
  eventName!: (typeof ANALYTICS_EVENT_NAMES)[number];

  @ApiPropertyOptional({ example: '2026-07-30T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schemaVersion?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class AnalyticsBatchDto {
  @ApiProperty({ type: [AnalyticsEventDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AnalyticsEventDto)
  events!: AnalyticsEventDto[];
}

export class AnalyticsStatisticsQueryDto {
  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-07-30' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({ example: 'Asia/Tashkent' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class AnalyticsIngestResponseDto {
  @ApiProperty({ example: 3 })
  accepted!: number;

  @ApiProperty({ example: 1 })
  duplicates!: number;
}

export class AnalyticsEventCountDto {
  @ApiProperty()
  eventName!: string;

  @ApiProperty()
  count!: number;
}

export class AnalyticsDailyPointDto {
  @ApiProperty({ example: '2026-07-30' })
  localDate!: string;

  @ApiProperty()
  count!: number;
}

export class AnalyticsTopItemDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  count!: number;
}

export class AnalyticsStatisticsResponseDto {
  @ApiProperty({ example: '2026-07-01' })
  from!: string;

  @ApiProperty({ example: '2026-07-30' })
  to!: string;

  @ApiProperty({ example: 'Asia/Tashkent' })
  timezone!: string;

  @ApiProperty()
  totalEvents!: number;

  @ApiProperty()
  uniqueActiveDays!: number;

  @ApiProperty({ type: [AnalyticsEventCountDto] })
  countsByEvent!: AnalyticsEventCountDto[];

  @ApiProperty({ type: [AnalyticsDailyPointDto] })
  dailySeries!: AnalyticsDailyPointDto[];

  @ApiProperty({ type: [AnalyticsTopItemDto] })
  topSurahs!: AnalyticsTopItemDto[];

  @ApiProperty({ type: [AnalyticsTopItemDto] })
  topAyahs!: AnalyticsTopItemDto[];

  @ApiProperty()
  searchCount!: number;

  @ApiProperty()
  shareCount!: number;

  @ApiProperty()
  audioPlayCount!: number;

  @ApiPropertyOptional({ nullable: true })
  firstEventAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  lastEventAt!: Date | null;
}
