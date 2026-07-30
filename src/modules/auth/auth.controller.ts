import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Body,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../infrastructure/auth/interfaces/jwt-payload.interface';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService } from './auth.service';
import { AuthContext } from './decorators/auth-context.decorator';
import { AuthTokensResponseDto } from './dto/auth-response.dto';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { AuthRequestContext } from './interfaces/auth-request-context.interface';

@ApiTags('Auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with Telegram Mini App initData' })
  @ApiBody({ type: TelegramAuthDto })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid Telegram initData' })
  async loginWithTelegram(
    @Body() body: TelegramAuthDto,
    @AuthContext() context: AuthRequestContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokensResponseDto> {
    return this.authService.loginWithTelegram(body.initData, context, response);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token and issue a new access token',
  })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() request: Request,
    @AuthContext() context: AuthRequestContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokensResponseDto> {
    const refreshToken = this.readCookie(
      request,
      this.authCookieService.cookieName,
    );

    return this.authService.refresh(refreshToken, context, response);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Revoke the current session and clear refresh cookie',
  })
  @ApiOkResponse({ description: 'Session revoked' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async logout(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    return this.authService.logout(currentUser, response);
  }

  private readCookie(request: Request, name: string): string | undefined {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[name];
    return typeof value === 'string' ? value : undefined;
  }
}
