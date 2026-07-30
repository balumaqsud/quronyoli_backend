import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { TELEGRAM_WEBHOOK_SECRET_HEADER } from '../../common/constants';
import { parseVerseKey } from '../../common/quran/ayah-coordinate';
import {
  TelegramLinksResponseDto,
  TelegramUpdateDto,
} from './dto/telegram.dto';
import { TelegramWebhookGuard } from './guards/telegram-webhook.guard';
import { TelegramLinksService } from './telegram-links.service';
import { TelegramUpdateDispatcher } from './telegram-update.dispatcher';

@ApiTags('Telegram')
@Controller({
  path: 'telegram',
  version: '1',
})
export class TelegramController {
  constructor(
    private readonly updateDispatcher: TelegramUpdateDispatcher,
    private readonly linksService: TelegramLinksService,
  ) {}

  @Public()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TelegramWebhookGuard)
  @ApiOperation({ summary: 'Telegram Bot API webhook receiver' })
  @ApiHeader({
    name: TELEGRAM_WEBHOOK_SECRET_HEADER,
    required: true,
  })
  @ApiOkResponse({ description: 'Update accepted' })
  @ApiUnauthorizedResponse({ description: 'Invalid webhook secret' })
  async webhook(@Body() update: TelegramUpdateDto): Promise<{ ok: true }> {
    await this.updateDispatcher.dispatch(update as never);
    return { ok: true };
  }

  @Get('links/mini-app')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get Mini App and bot deep links' })
  @ApiOkResponse({ type: TelegramLinksResponseDto })
  getMiniAppLinks(): TelegramLinksResponseDto {
    return this.linksService.getMiniAppLinks();
  }

  @Get('share/ayah/:verseKey')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Build share and deep links for an ayah' })
  @ApiOkResponse({ type: TelegramLinksResponseDto })
  shareAyah(@Param('verseKey') verseKey: string): TelegramLinksResponseDto {
    const coordinate = parseVerseKey(verseKey);
    return this.linksService.getAyahShareLinks(
      coordinate.chapterNumber,
      coordinate.verseNumber,
    );
  }
}
