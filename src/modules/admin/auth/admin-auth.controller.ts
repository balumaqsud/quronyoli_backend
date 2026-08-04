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
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { AuthCookieService } from '../../auth/auth-cookie.service';
import { AuthContext } from '../../auth/decorators/auth-context.decorator';
import { TelegramAuthDto } from '../../auth/dto/telegram-auth.dto';
import { AuthRequestContext } from '../../auth/interfaces/auth-request-context.interface';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthTokensResponseDto } from './dto/admin-auth-response.dto';

@ApiTags('Admin Auth')
@Controller({
  path: 'admin/auth',
  version: '1',
})
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Public()
  @Throttle({
    default: {
      limit: Number.parseInt(process.env.THROTTLE_AUTH_LIMIT ?? '20', 10),
      ttl: Number.parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    },
  })
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate admin with Telegram Mini App initData',
  })
  @ApiBody({ type: TelegramAuthDto })
  @ApiOkResponse({ type: AdminAuthTokensResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid Telegram initData' })
  @ApiForbiddenResponse({ description: 'Not an admin or banned' })
  async loginWithTelegram(
    @Body() body: TelegramAuthDto,
    @AuthContext() context: AuthRequestContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminAuthTokensResponseDto> {
    return this.adminAuthService.loginWithTelegram(
      body.initData,
      context,
      response,
    );
  }

  @Public()
  @Throttle({
    default: {
      limit: Number.parseInt(process.env.THROTTLE_AUTH_LIMIT ?? '20', 10),
      ttl: Number.parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    },
  })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh admin access token' })
  @ApiOkResponse({ type: AdminAuthTokensResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() request: Request,
    @AuthContext() context: AuthRequestContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminAuthTokensResponseDto> {
    const refreshToken = this.readCookie(
      request,
      this.authCookieService.cookieName,
    );

    return this.adminAuthService.refresh(refreshToken, context, response);
  }

  private readCookie(request: Request, name: string): string | undefined {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[name];
    return typeof value === 'string' ? value : undefined;
  }
}
