import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/interfaces/user.interface';

export class AuthTokensResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: Object })
  user!: UserResponseDto;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Telegram Mini App start_param when present in initData',
  })
  startParam!: string | null;
}
