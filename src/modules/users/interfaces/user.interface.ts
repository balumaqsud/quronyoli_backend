export interface UpsertTelegramUserInput {
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  languageCode?: string;
  photoUrl?: string;
  isPremium: boolean;
  allowsWriteToPm: boolean;
}

export interface UserResponseDto {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string | null;
  photoUrl: string | null;
  isPremium: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}
