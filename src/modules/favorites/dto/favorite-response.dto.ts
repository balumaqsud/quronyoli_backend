import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FavoriteResponseDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ example: 2 })
  chapterNumber!: number;

  @ApiProperty({ example: 255 })
  verseNumber!: number;

  @ApiProperty({ example: '2:255' })
  verseKey!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedFavoritesResponseDto {
  @ApiProperty({ type: [FavoriteResponseDto] })
  items!: FavoriteResponseDto[];

  @ApiPropertyOptional({ nullable: true })
  nextCursor!: string | null;
}
