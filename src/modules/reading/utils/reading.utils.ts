import { BadRequestException } from '@nestjs/common';
import { isValidAyahCoordinate } from '../constants/quran-coordinates';

export interface AyahCoordinate {
  chapterNumber: number;
  verseNumber: number;
  verseKey: string;
}

export function parseVerseKey(verseKey: string): AyahCoordinate {
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(verseKey.trim());
  if (!match) {
    throw new BadRequestException(
      'verseKey must be in chapter:verse format (e.g. 2:255)',
    );
  }

  const chapterNumber = Number.parseInt(match[1] ?? '', 10);
  const verseNumber = Number.parseInt(match[2] ?? '', 10);

  if (!isValidAyahCoordinate(chapterNumber, verseNumber)) {
    throw new BadRequestException(
      `Invalid ayah coordinate: ${chapterNumber}:${verseNumber}`,
    );
  }

  return {
    chapterNumber,
    verseNumber,
    verseKey: `${chapterNumber}:${verseNumber}`,
  };
}

export function formatLocalDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function toDateOnly(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const date = toDateOnly(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export interface KeysetCursor {
  at: string;
  id: string;
}

export function encodeKeysetCursor(cursor: KeysetCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeKeysetCursor(raw: string): KeysetCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as KeysetCursor;

    if (
      typeof parsed.at !== 'string' ||
      typeof parsed.id !== 'string' ||
      Number.isNaN(Date.parse(parsed.at))
    ) {
      throw new Error('invalid cursor');
    }

    return parsed;
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
}
