import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/interfaces/user.interface';

export class AuthTokensResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: Object })
  user!: UserResponseDto;
}
