import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService } from './auth.service';
import { AuthRequestContextMiddleware } from './middleware/auth-request-context.middleware';
import { SessionsRepository } from './sessions.repository';
import { TelegramInitDataVerifier } from './telegram/telegram-init-data.verifier';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookieService,
    SessionsRepository,
    TelegramInitDataVerifier,
  ],
  exports: [AuthCookieService, SessionsRepository, TelegramInitDataVerifier],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthRequestContextMiddleware).forRoutes(AuthController);
  }
}
