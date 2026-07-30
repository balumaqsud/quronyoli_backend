import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
