import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookmarkResponseDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ example: 2 })
  chapterNumber!: number;

  @ApiProperty({ example: 255 })
  verseNumber!: number;

  @ApiProperty({ example: '2:255' })
  verseKey!: string;

  @ApiPropertyOptional({ example: 1, nullable: true })
  wordNumber!: number | null;

  @ApiPropertyOptional({ example: 1200, nullable: true })
  audioOffsetMs!: number | null;

  @ApiPropertyOptional({ example: 'Ayat al-Kursi', nullable: true })
  label!: string | null;

  @ApiPropertyOptional({ example: 'Memorize this ayah', nullable: true })
  note!: string | null;

  @ApiPropertyOptional({ example: '#2F6B4F', nullable: true })
  color!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedBookmarksResponseDto {
  @ApiProperty({ type: [BookmarkResponseDto] })
  items!: BookmarkResponseDto[];

  @ApiPropertyOptional({ nullable: true })
  nextCursor!: string | null;
}
