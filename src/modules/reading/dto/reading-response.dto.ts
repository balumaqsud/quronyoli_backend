import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AyahCoordinateDto {
  @ApiProperty({ example: 2 })
  chapterNumber!: number;

  @ApiProperty({ example: 255 })
  verseNumber!: number;

  @ApiProperty({ example: '2:255' })
  verseKey!: string;
}

export class ContinueReadingResponseDto extends AyahCoordinateDto {
  @ApiPropertyOptional({ example: 1, nullable: true })
  wordNumber!: number | null;

  @ApiProperty({ example: '2026-07-30T08:00:00.000Z' })
  lastReadAt!: Date;
}

export class RecentAyahItemDto extends AyahCoordinateDto {
  @ApiProperty({ example: '2026-07-30T08:00:00.000Z' })
  lastReadAt!: Date;

  @ApiProperty({ example: '2026-07-01T08:00:00.000Z' })
  firstReadAt!: Date;

  @ApiProperty({ example: 3 })
  readCount!: number;
}

export class HistoryAyahItemDto extends AyahCoordinateDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ example: '2026-07-30T08:00:00.000Z' })
  openedAt!: Date;
}

export class PaginatedRecentResponseDto {
  @ApiProperty({ type: [RecentAyahItemDto] })
  items!: RecentAyahItemDto[];

  @ApiPropertyOptional({ nullable: true })
  nextCursor!: string | null;
}

export class PaginatedHistoryResponseDto {
  @ApiProperty({ type: [HistoryAyahItemDto] })
  items!: HistoryAyahItemDto[];

  @ApiPropertyOptional({ nullable: true })
  nextCursor!: string | null;
}

export class ReadingProgressResponseDto {
  @ApiProperty({ example: 150 })
  uniqueAyahsRead!: number;

  @ApiProperty({ example: 6236 })
  totalQuranAyahs!: number;

  @ApiProperty({ example: 2.41, description: 'Percentage 0-100, 2 decimals' })
  completionPercentage!: number;

  @ApiProperty({ example: 220, description: 'Sum of all open events' })
  totalOpens!: number;

  @ApiProperty({
    example: 70,
    description: 'Repeated opens beyond the first unique read',
  })
  repeatedOpens!: number;

  @ApiPropertyOptional({ type: ContinueReadingResponseDto, nullable: true })
  continue!: ContinueReadingResponseDto | null;
}

export class DailyReadingItemDto {
  @ApiProperty({ example: '2026-07-30' })
  localDate!: string;

  @ApiProperty({ example: 'Asia/Tashkent' })
  timezone!: string;

  @ApiProperty({ example: 12 })
  versesRead!: number;

  @ApiProperty({ example: 0 })
  activeSeconds!: number;

  @ApiProperty({ example: 0 })
  sessionsCount!: number;
}

export class DailyReadingResponseDto {
  @ApiProperty({ type: [DailyReadingItemDto] })
  items!: DailyReadingItemDto[];
}

export class PeriodActivityDto {
  @ApiProperty({ example: 12 })
  versesRead!: number;

  @ApiProperty({ example: 0 })
  activeSeconds!: number;

  @ApiProperty({ example: 3 })
  activeDays!: number;
}

export class ReadingStatisticsResponseDto {
  @ApiProperty({ example: 220 })
  totalOpens!: number;

  @ApiProperty({ example: 150 })
  uniqueAyahsRead!: number;

  @ApiProperty({ example: 2.41 })
  completionPercentage!: number;

  @ApiProperty({ example: 45 })
  totalActiveDays!: number;

  @ApiProperty({ example: 5 })
  currentStreakDays!: number;

  @ApiProperty({ example: 12 })
  longestStreakDays!: number;

  @ApiProperty({ type: PeriodActivityDto })
  today!: PeriodActivityDto;

  @ApiProperty({ type: PeriodActivityDto })
  last7Days!: PeriodActivityDto;

  @ApiProperty({ type: PeriodActivityDto })
  last30Days!: PeriodActivityDto;

  @ApiPropertyOptional({ type: ContinueReadingResponseDto, nullable: true })
  continue!: ContinueReadingResponseDto | null;
}

export class ReadingStreakResponseDto {
  @ApiProperty({ example: 5 })
  currentStreakDays!: number;

  @ApiProperty({ example: 12 })
  longestStreakDays!: number;

  @ApiProperty({ example: true })
  todayActive!: boolean;

  @ApiProperty({ example: '2026-07-30' })
  localDate!: string;

  @ApiProperty({ example: 'Asia/Tashkent' })
  timezone!: string;
}
