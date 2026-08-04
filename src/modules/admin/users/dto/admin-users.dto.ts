import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { OffsetPaginationQueryDto } from '../../../../common/pagination/offset-pagination.dto';
import { toOptionalBoolean } from '../../../../common/validation/to-optional-boolean';

export class AdminUsersQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Search by username, name, or telegram id',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by language code' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  languageCode?: string;

  @ApiPropertyOptional({ description: 'Filter banned users' })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isBanned?: boolean;

  @ApiPropertyOptional({ description: 'Filter users who are admins' })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isAdmin?: boolean;

  @ApiPropertyOptional({
    description:
      'Include soft-deleted users. Default false (only non-deleted).',
    default: false,
  })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;
}

export class UpdateAdminUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  firstName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  languageCode?: string | null;
}
