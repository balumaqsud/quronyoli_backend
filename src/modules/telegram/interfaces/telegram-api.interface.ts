export interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  web_app?: { url: string };
  callback_data?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramSendMessageRequest {
  chatId: number | string;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableWebPagePreview?: boolean;
  replyMarkup?: TelegramInlineKeyboardMarkup;
  messageId?: number;
}

export interface TelegramSendAudioRequest {
  chatId: number | string;
  audioUrl: string;
  caption?: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  title?: string;
  performer?: string;
}

export interface TelegramAnswerCallbackQueryRequest {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
  url?: string;
}

export interface TelegramEditMessageRequest {
  chatId: number | string;
  messageId: number;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableWebPagePreview?: boolean;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}

export interface TelegramBotCommand {
  command: string;
  description: string;
}

export interface TelegramMenuButtonWebApp {
  type: 'web_app';
  text: string;
  web_app: { url: string };
}

export interface TelegramMenuButtonCommands {
  type: 'commands';
}

export interface TelegramMenuButtonDefault {
  type: 'default';
}

export type TelegramMenuButton =
  | TelegramMenuButtonWebApp
  | TelegramMenuButtonCommands
  | TelegramMenuButtonDefault;

export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  text?: string;
  date: number;
  reply_markup?: TelegramInlineKeyboardMarkup;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramIncomingMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  reply_markup?: TelegramInlineKeyboardMarkup;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramIncomingMessage;
  data?: string;
  chat_instance: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramIncomingMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_message?: string;
}

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: {
    retry_after?: number;
  };
}

export interface TelegramApi {
  sendMessage(request: TelegramSendMessageRequest): Promise<TelegramMessage>;
  sendAudio(request: TelegramSendAudioRequest): Promise<TelegramMessage>;
  answerCallbackQuery(
    request: TelegramAnswerCallbackQueryRequest,
  ): Promise<boolean>;
  editMessageText(
    request: TelegramEditMessageRequest,
  ): Promise<TelegramMessage | boolean>;
  setMyCommands(commands: TelegramBotCommand[]): Promise<boolean>;
  setChatMenuButton(menuButton: TelegramMenuButton): Promise<boolean>;
  setWebhook(
    url: string,
    secretToken: string,
    dropPendingUpdates?: boolean,
  ): Promise<boolean>;
  deleteWebhook(dropPendingUpdates?: boolean): Promise<boolean>;
  getWebhookInfo(): Promise<TelegramWebhookInfo>;
}
