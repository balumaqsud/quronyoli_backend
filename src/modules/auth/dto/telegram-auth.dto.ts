import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TelegramAuthDto {
  @ApiProperty({
    description: 'Telegram WebApp initData query string',
    example:
      'query_id=AA...&user=%7B%22id%22%3A1%7D&auth_date=1710000000&hash=abc',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8192)
  initData!: string;
}
