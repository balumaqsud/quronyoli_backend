import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, Matches } from 'class-validator';

export class UpsertDailyReminderDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({
    example: '07:30',
    description: 'Local wall-clock time HH:mm in the user timezone',
  })
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/, {
    message: 'localTime must be HH:mm',
  })
  localTime!: string;
}

export class DailyReminderResponseDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ example: '07:30' })
  localTime!: string;

  @ApiProperty({ example: 'Asia/Tashkent' })
  timezone!: string;

  @ApiProperty({
    description:
      'Whether Telegram allows the bot to write to the user PM (from initData)',
  })
  allowsWriteToPm!: boolean;

  @ApiProperty({ nullable: true })
  updatedAt!: Date | null;
}
