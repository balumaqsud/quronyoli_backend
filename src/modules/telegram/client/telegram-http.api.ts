import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CONFIG_KEYS } from '../../../common/constants';
import { TelegramConfig } from '../../../config/configuration';
import { TelegramErrorMapper } from '../errors/telegram-error.mapper';
import {
  TelegramApi,
  TelegramApiResponse,
  TelegramMessage,
  TelegramSendMessageRequest,
  TelegramWebhookInfo,
} from '../interfaces/telegram-api.interface';

@Injectable()
export class TelegramHttpApi implements TelegramApi {
  private readonly config: TelegramConfig;

  constructor(
    private readonly httpService: HttpService,
    private readonly errorMapper: TelegramErrorMapper,
    private readonly configService: ConfigService,
    @InjectPinoLogger(TelegramHttpApi.name)
    private readonly logger: PinoLogger,
  ) {
    this.config = this.configService.getOrThrow<TelegramConfig>(
      CONFIG_KEYS.TELEGRAM,
    );
  }

  async sendMessage(
    request: TelegramSendMessageRequest,
  ): Promise<TelegramMessage> {
    return this.call<TelegramMessage>('sendMessage', {
      chat_id: request.chatId,
      text: request.text,
      parse_mode: request.parseMode,
      disable_web_page_preview: request.disableWebPagePreview,
      reply_markup: request.replyMarkup,
    });
  }

  async setWebhook(url: string, secretToken: string): Promise<boolean> {
    return this.call<boolean>('setWebhook', {
      url,
      secret_token: secretToken,
      drop_pending_updates: false,
      allowed_updates: ['message'],
    });
  }

  async deleteWebhook(dropPendingUpdates = false): Promise<boolean> {
    return this.call<boolean>('deleteWebhook', {
      drop_pending_updates: dropPendingUpdates,
    });
  }

  async getWebhookInfo(): Promise<TelegramWebhookInfo> {
    return this.call<TelegramWebhookInfo>('getWebhookInfo');
  }

  private async call<T>(
    method: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.config.apiBaseUrl}/bot${this.config.botToken}/${method}`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<TelegramApiResponse<T>>(url, body ?? {}, {
          timeout: this.config.timeoutMs,
        }),
      );

      if (!response.data.ok || response.data.result === undefined) {
        this.logger.warn(
          { method },
          'Telegram API returned unsuccessful response',
        );
        throw new AxiosError(
          response.data.description ?? 'Telegram API error',
          String(response.data.error_code ?? 'TELEGRAM_ERROR'),
          undefined,
          undefined,
          {
            status: response.data.error_code ?? 400,
            statusText: response.data.description ?? 'Telegram API error',
            headers: {},
            config: {} as never,
            data: response.data,
          },
        );
      }

      return response.data.result;
    } catch (error) {
      this.errorMapper.map(error);
    }
  }
}
