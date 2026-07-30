import { BadRequestException } from '@nestjs/common';
import { parseVerseKey } from '../../../common/quran/ayah-coordinate';

export { parseVerseKey };

export {
  formatLocalDate,
  shiftIsoDate,
  toDateOnly,
} from './reading-date.utils';

export function parseVerseKeyOrThrow(verseKey: string) {
  try {
    return parseVerseKey(verseKey);
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException('Invalid verse key');
  }
}
