import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthRequestContextMiddleware } from '../auth/middleware/auth-request-context.middleware';
import { QuranModule } from '../quran/quran.module';
import { UsersModule } from '../users/users.module';
import { AdminAdminsController } from './admins/admin-admins.controller';
import { AdminAdminsService } from './admins/admin-admins.service';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';
import { AdminLogsController } from './logs/admin-logs.controller';
import { AdminLogsService } from './logs/admin-logs.service';
import { AdminQarisController } from './qaris/admin-qaris.controller';
import { AdminQarisService } from './qaris/admin-qaris.service';
import { AdminTafsirsController } from './tafsirs/admin-tafsirs.controller';
import { AdminTafsirsService } from './tafsirs/admin-tafsirs.service';
import { AdminTranslationsController } from './translations/admin-translations.controller';
import { AdminTranslationsService } from './translations/admin-translations.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [AuthModule, UsersModule, QuranModule],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    AdminUsersController,
    AdminQarisController,
    AdminTranslationsController,
    AdminTafsirsController,
    AdminAdminsController,
    AdminLogsController,
  ],
  providers: [
    AdminAuthService,
    AdminDashboardService,
    AdminUsersService,
    AdminQarisService,
    AdminTranslationsService,
    AdminTafsirsService,
    AdminAdminsService,
    AdminLogsService,
    AdminGuard,
    RolesGuard,
  ],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(AuthRequestContextMiddleware)
      .forRoutes(
        AdminAuthController,
        AdminUsersController,
        AdminQarisController,
        AdminTranslationsController,
        AdminTafsirsController,
        AdminAdminsController,
      );
  }
}
