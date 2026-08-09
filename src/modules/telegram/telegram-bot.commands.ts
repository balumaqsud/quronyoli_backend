/** BotFather menu — Mini App–first (entry only). */
import { TelegramBotCommand } from './interfaces/telegram-api.interface';

export const TELEGRAM_BOT_COMMANDS: TelegramBotCommand[] = [
  { command: 'start', description: 'Botni boshlash' },
  { command: 'ilova', description: 'Ilovani ochish' },
  { command: 'stop', description: "Oyat eslatmalarini o'chirish" },
];

export const SURAH_PAGE_SIZE = 15;
export const DEFAULT_BOT_RECITER_EXTERNAL_ID = '7';
export const TELEGRAM_HTML_LIMIT = 3900;
