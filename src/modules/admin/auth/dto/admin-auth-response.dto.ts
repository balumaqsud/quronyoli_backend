import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '../../../../generated/prisma';

export class AdminAuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  telegramId!: string;

  @ApiPropertyOptional({ nullable: true })
  username!: string | null;

  @ApiProperty()
  firstName!: string;

  @ApiPropertyOptional({ nullable: true })
  lastName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  photoUrl!: string | null;
}

export class AdminAuthProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: AdminRole })
  role!: AdminRole;

  @ApiProperty({ type: AdminAuthUserDto })
  user!: AdminAuthUserDto;
}

export class AdminAuthTokensResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: AdminAuthProfileDto })
  admin!: AdminAuthProfileDto;
}
