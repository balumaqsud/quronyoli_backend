import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';
import {
  DailyReminderResponseDto,
  UpsertDailyReminderDto,
} from './dto/reminder.dto';
import { NotificationsRepository } from './notifications.repository';

const IANA_TIMEZONE_PATTERN = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$|^UTC$/;

@Injectable()
export class RemindersService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
  ) {}

  async getDailyReminder(userId: string): Promise<DailyReminderResponseDto> {
    const user = await this.usersService.getActiveByIdOrThrow(userId);
    const timezone = await this.assertValidTimezone(userId);
    const preference =
      await this.notificationsRepository.findReminderPreference(userId);

    if (!preference) {
      return {
        enabled: false,
        localTime: '07:00',
        timezone,
        allowsWriteToPm: user.allowsWriteToPm,
        updatedAt: null,
      };
    }

    return {
      enabled: preference.enabled,
      localTime: preference.localTime,
      timezone,
      allowsWriteToPm: user.allowsWriteToPm,
      updatedAt: preference.updatedAt,
    };
  }

  async upsertDailyReminder(
    userId: string,
    dto: UpsertDailyReminderDto,
  ): Promise<DailyReminderResponseDto> {
    const user = await this.usersService.getActiveByIdOrThrow(userId);
    const timezone = await this.assertValidTimezone(userId);
    const preference =
      await this.notificationsRepository.upsertReminderPreference({
        userId,
        enabled: dto.enabled,
        localTime: dto.localTime,
      });

    await this.settingsService.syncAyatRemindersEnabledFromPreference(
      userId,
      dto.enabled,
    );

    return {
      enabled: preference.enabled,
      localTime: preference.localTime,
      timezone,
      allowsWriteToPm: user.allowsWriteToPm,
      updatedAt: preference.updatedAt,
    };
  }

  async deleteDailyReminder(userId: string): Promise<{ deleted: true }> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const deleted =
      await this.notificationsRepository.deleteReminderPreference(userId);
    if (!deleted) {
      throw new NotFoundException('Daily reminder preference not found');
    }
    await this.settingsService.syncAyatRemindersEnabledFromPreference(
      userId,
      false,
    );
    return { deleted: true };
  }

  private async assertValidTimezone(userId: string): Promise<string> {
    const timezone = await this.notificationsRepository.getTimezone(userId);
    if (!IANA_TIMEZONE_PATTERN.test(timezone)) {
      throw new BadRequestException(
        'User timezone must be a valid IANA timezone before enabling reminders',
      );
    }

    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      throw new BadRequestException(
        'User timezone must be a valid IANA timezone before enabling reminders',
      );
    }

    return timezone;
  }
}
