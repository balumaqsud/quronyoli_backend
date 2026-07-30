import { BadRequestException } from '@nestjs/common';
import {
  AyahCoordinate,
  isValidAyahCoordinate,
  toVerseKey,
} from './quran-coordinates';

export type { AyahCoordinate };

export function parseVerseKey(verseKey: string): AyahCoordinate {
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(verseKey.trim());
  if (!match) {
    throw new BadRequestException(
      'verseKey must be in chapter:verse format (e.g. 2:255)',
    );
  }

  const chapterNumber = Number.parseInt(match[1] ?? '', 10);
  const verseNumber = Number.parseInt(match[2] ?? '', 10);

  return assertAyahCoordinateOrThrow(chapterNumber, verseNumber);
}

export function assertAyahCoordinateOrThrow(
  chapterNumber: number,
  verseNumber: number,
): AyahCoordinate {
  if (!isValidAyahCoordinate(chapterNumber, verseNumber)) {
    throw new BadRequestException(
      `Invalid ayah coordinate: ${chapterNumber}:${verseNumber}`,
    );
  }

  return {
    chapterNumber,
    verseNumber,
    verseKey: toVerseKey(chapterNumber, verseNumber),
  };
}
