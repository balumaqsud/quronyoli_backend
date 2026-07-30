import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class TelegramChatDto {
  @ApiProperty()
  @IsInt()
  id!: number;

  @ApiProperty()
  @IsString()
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  is_forum?: boolean;
}

class TelegramMessageDto {
  @ApiProperty()
  @IsInt()
  message_id!: number;

  @ApiProperty({ type: TelegramChatDto })
  @ValidateNested()
  @Type(() => TelegramChatDto)
  chat!: TelegramChatDto;

  @ApiProperty()
  @IsInt()
  date!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  from?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @Allow()
  entities?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @Allow()
  caption_entities?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  reply_to_message?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  photo?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  document?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  sticker?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  voice?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  audio?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  video?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  animation?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  contact?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  location?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  message_thread_id?: number;
}

export class TelegramUpdateDto {
  @ApiProperty()
  @IsInt()
  update_id!: number;

  @ApiPropertyOptional({ type: TelegramMessageDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramMessageDto)
  message?: TelegramMessageDto;

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
