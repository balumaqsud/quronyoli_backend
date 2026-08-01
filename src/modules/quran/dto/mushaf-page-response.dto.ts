import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MushafPageListItemDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: '1:1' })
  firstVerse!: string;

  @ApiProperty({ example: '1:7' })
  lastVerse!: string;

  @ApiProperty({ example: 7 })
  verseCount!: number;
}

export class MushafPageDetailDto {
  @ApiProperty({ example: 1 })
  pageNumber!: number;

  @ApiProperty({ example: 1, description: 'Mushaf ID (1 = Madani QCF V2)' })
  mushafId!: number;

  @ApiProperty({ example: '1:1' })
  firstVerseKey!: string;

  @ApiProperty({ example: '1:7' })
  lastVerseKey!: string;

  @ApiProperty({ example: 7 })
  verseCount!: number;

  @ApiProperty({ type: [Number], example: [1] })
  surahIds!: number[];

  @ApiProperty({ example: 1 })
  juzNumber!: number;

  @ApiProperty({ example: 1 })
  hizbNumber!: number;

  @ApiProperty({ example: 1, description: 'Primary rub el hizb for the page' })
  rubElHizb!: number;

  @ApiProperty({ type: [Number], example: [1] })
  juzNumbers!: number[];

  @ApiProperty({ type: [Number], example: [1] })
  hizbNumbers!: number[];

  @ApiProperty({ type: [Number], example: [1] })
  rubElHizbNumbers!: number[];

  @ApiProperty({
    type: [String],
    example: ['1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7'],
    description: 'Verse keys on this page (relationships only; no text)',
  })
  verses!: string[];

  @ApiPropertyOptional({
    nullable: true,
    example: 'https://c22506.r6.cf1.rackcdn.com/1_1.png',
  })
  imageUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 675 })
  imageWidth!: number | null;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  syncedAt!: string;
}

export class MushafPageVersesResponseDto {
  @ApiProperty({ type: MushafPageDetailDto })
  page!: MushafPageDetailDto;

  @ApiProperty({
    description:
      'QF verse bodies for this page (Arabic, words, optional translations/tafsir/audio)',
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  verses!: Record<string, unknown>[];
}
