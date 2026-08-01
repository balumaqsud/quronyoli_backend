import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MushafPageResponseDto {
  @ApiProperty({ example: 1 })
  page_number!: number;

  @ApiProperty({ example: 1, description: 'Mushaf ID (1 = Madani QCF V2)' })
  mushaf_id!: number;

  @ApiProperty({ example: '1:1' })
  first_verse_key!: string;

  @ApiProperty({ example: '1:7' })
  last_verse_key!: string;

  @ApiProperty({ type: [String], example: ['1:1', '1:2'] })
  verse_keys!: string[];

  @ApiProperty({ type: [Number], example: [1] })
  surah_ids!: number[];

  @ApiProperty({ example: 1 })
  juz_number!: number;

  @ApiProperty({ example: 1 })
  hizb_number!: number;

  @ApiProperty({ example: 1, description: 'Primary rub el hizb for the page' })
  rub_el_hizb!: number;

  @ApiProperty({ type: [Number], example: [1] })
  juz_numbers!: number[];

  @ApiProperty({ type: [Number], example: [1] })
  hizb_numbers!: number[];

  @ApiProperty({ type: [Number], example: [1] })
  rub_el_hizb_numbers!: number[];

  @ApiProperty({ example: 7 })
  verse_count!: number;

  @ApiPropertyOptional({
    nullable: true,
    example: 'https://c22506.r6.cf1.rackcdn.com/1_1.png',
  })
  image_url!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 675 })
  image_width!: number | null;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  synced_at!: string;
}

export class MushafPagesListResponseDto {
  @ApiProperty({ example: 1 })
  mushaf_id!: number;

  @ApiProperty({ example: 604 })
  total!: number;

  @ApiProperty({ type: [MushafPageResponseDto] })
  pages!: MushafPageResponseDto[];
}

export class MushafPageDetailResponseDto {
  @ApiProperty({ type: MushafPageResponseDto })
  page!: MushafPageResponseDto;
}
