import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../infrastructure/auth/interfaces/jwt-payload.interface';
import { SettingsResponseDto } from './dto/settings-response.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@Controller({
  path: 'settings',
  version: '1',
})
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the authenticated user settings',
    description:
      'Returns persisted preferences. Creates default settings on first access.',
  })
  @ApiOkResponse({
    description: 'User settings',
    type: SettingsResponseDto,
  })
  getSettings(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<SettingsResponseDto> {
    return this.settingsService.getForUser(currentUser.sub);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update the authenticated user settings',
    description:
      'Partial update. Omitted fields are preserved. Pass null for translationId, tafsirId, or reciterId to clear a default. Resource IDs must exist in the local Quran.Foundation catalog.',
  })
  @ApiBody({ type: UpdateSettingsDto })
  @ApiOkResponse({
    description: 'Updated user settings',
    type: SettingsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or unknown catalog resource ID',
  })
  updateSettings(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<SettingsResponseDto> {
    return this.settingsService.updateForUser(currentUser.sub, dto);
  }
}
