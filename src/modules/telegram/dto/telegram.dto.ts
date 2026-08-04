import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsInt, IsOptional } from 'class-validator';

/**
 * Inbound Telegram updates gain new message fields often. Keep only a light
 * top-level shape check — nested payloads are trusted after the webhook secret.
 */
export class TelegramUpdateDto {
  @ApiProperty()
  @IsInt()
  update_id!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  message?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  edited_message?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  callback_query?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  my_chat_member?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  chat_member?: unknown;
}

export class TelegramLinksResponseDto {
  @ApiProperty()
  botDeepLink!: string;

  @ApiProperty()
  miniAppDeepLink!: string;

  @ApiProperty()
  shareUrl!: string;

  @ApiProperty()
  shareText!: string;

  @ApiPropertyOptional()
  verseKey?: string;
}
