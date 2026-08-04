import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AdminRole } from '../../../../generated/prisma';
import { OffsetPaginationQueryDto } from '../../../../common/pagination/offset-pagination.dto';

export class AdminAdminsQueryDto extends OffsetPaginationQueryDto {}

export class CreateAdminDto {
  @ApiProperty({
    description: 'Existing user UUID to promote to admin',
  })
  @IsUUID('4')
  userId!: string;

  @ApiPropertyOptional({
    enum: AdminRole,
    default: AdminRole.ADMIN,
    description: 'Role to assign (SUPER_ADMIN can only be seeded)',
  })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole = AdminRole.ADMIN;
}

export class CreateAdminByTelegramDto {
  @ApiProperty({ description: 'Telegram user id' })
  @IsString()
  @MaxLength(64)
  telegramId!: string;

  @ApiPropertyOptional({ enum: AdminRole, default: AdminRole.ADMIN })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole = AdminRole.ADMIN;
}
