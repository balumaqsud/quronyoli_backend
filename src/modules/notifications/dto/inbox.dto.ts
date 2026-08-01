import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { KeysetPaginationQueryDto } from '../../../common/pagination/keyset-pagination.dto';
import { UserNotificationType } from '../../../generated/prisma';

export class ListNotificationsQueryDto extends KeysetPaginationQueryDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (value === true || value === 'true') {
      return true;
    }
    if (value === false || value === 'false') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  unreadOnly?: boolean;
}

export class UserNotificationResponseDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ enum: UserNotificationType })
  type!: UserNotificationType;

  @ApiProperty({ example: 'Kunlik eslatma' })
  title!: string;

  @ApiProperty({ example: 'Bugungi oyat: 2:255' })
  body!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Deep-link / context payload',
  })
  payload!: Record<string, unknown> | null;

  @ApiProperty({ nullable: true })
  readAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedNotificationsResponseDto {
  @ApiProperty({ type: [UserNotificationResponseDto] })
  items!: UserNotificationResponseDto[];

  @ApiPropertyOptional({ nullable: true })
  nextCursor!: string | null;
}

export class UnreadCountResponseDto {
  @ApiProperty({ example: 3 })
  count!: number;
}

export class ReadAllNotificationsResponseDto {
  @ApiProperty({ example: 5 })
  updated!: number;
}
