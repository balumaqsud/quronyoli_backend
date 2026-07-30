import { ApiProperty } from '@nestjs/swagger';

export class DailyAyahResponseDto {
  @ApiProperty({ example: '2026-07-30' })
  localDate!: string;

  @ApiProperty({ example: 'Asia/Tashkent' })
  timezone!: string;

  @ApiProperty({ example: '2:255' })
  verseKey!: string;

  @ApiProperty({ example: 2 })
  chapterNumber!: number;

  @ApiProperty({ example: 255 })
  verseNumber!: number;

  @ApiProperty({
    description: 'Upstream Quran.Foundation verse payload',
  })
  content!: unknown;
}
