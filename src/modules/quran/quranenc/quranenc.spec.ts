import {
  isQuranEncTranslationKey,
  QURANENC_KYRGYZ_HAKIMOV_KEY,
} from './quranenc.constants';
import {
  parseEncAyahRow,
  toNormalizedEncTranslationRow,
} from './quranenc.mapper';
import { splitTranslationIds } from './split-translation-ids';
import {
  collectChapterIdsFromVersesPayload,
  mergeEncIntoVersesPayload,
} from './merge-enc-translations';

describe('QuranEnc helpers', () => {
  describe('isQuranEncTranslationKey', () => {
    it('allows only kyrgyz_hakimov', () => {
      expect(isQuranEncTranslationKey(QURANENC_KYRGYZ_HAKIMOV_KEY)).toBe(true);
      expect(isQuranEncTranslationKey('55')).toBe(false);
      expect(isQuranEncTranslationKey('kyrgyz_other')).toBe(false);
    });
  });

  describe('splitTranslationIds', () => {
    it('splits QF numeric ids from Enc keys', () => {
      expect(splitTranslationIds('55,kyrgyz_hakimov,20')).toEqual({
        qfTranslations: '55,20',
        encKeys: ['kyrgyz_hakimov'],
      });
    });

    it('drops unknown non-numeric tokens', () => {
      expect(splitTranslationIds('55,evil_key')).toEqual({
        qfTranslations: '55',
        encKeys: [],
      });
    });

    it('handles Enc-only and empty', () => {
      expect(splitTranslationIds('kyrgyz_hakimov')).toEqual({
        qfTranslations: '',
        encKeys: ['kyrgyz_hakimov'],
      });
      expect(splitTranslationIds(undefined)).toEqual({
        qfTranslations: '',
        encKeys: [],
      });
    });
  });

  describe('parseEncAyahRow / normalize', () => {
    it('maps QuranEnc ayah into QF-shaped row and preserves footnotes', () => {
      const parsed = parseEncAyahRow({
        sura: '1',
        aya: '2',
        translation: 'Test',
        footnotes: '[1] note',
        arabic_text: 'ignored',
      });
      expect(parsed).toEqual({
        sura: 1,
        aya: 2,
        translation: 'Test',
        footnotes: '[1] note',
      });
      expect(
        toNormalizedEncTranslationRow(
          parsed!,
          'kyrgyz_hakimov',
          'Kyrgyz — Shamsuddin Hakimov',
        ),
      ).toEqual({
        resource_id: 'kyrgyz_hakimov',
        resource_name: 'Kyrgyz — Shamsuddin Hakimov',
        text: 'Test',
        verse_key: '1:2',
        verse_number: 2,
        footnotes: '[1] note',
      });
    });
  });

  describe('mergeEncIntoVersesPayload', () => {
    it('attaches Enc text without replacing Arabic or QF translations', () => {
      const encMap = new Map([
        [
          1,
          new Map([
            [
              1,
              {
                resource_id: 'kyrgyz_hakimov',
                resource_name: 'Kyrgyz — Shamsuddin Hakimov',
                text: 'Кыргызча',
                verse_key: '1:1',
                verse_number: 1,
              },
            ],
          ]),
        ],
      ]);

      const merged = mergeEncIntoVersesPayload(
        {
          verses: [
            {
              chapter_id: 1,
              verse_number: 1,
              verse_key: '1:1',
              text_uthmani: 'بِسْمِ',
              translations: [{ resource_id: 55, text: 'Bismillah' }],
            },
          ],
        },
        encMap,
      ) as { verses: Array<Record<string, unknown>> };

      expect(merged.verses[0].text_uthmani).toBe('بِسْمِ');
      expect(merged.verses[0].translations).toEqual([
        { resource_id: 55, text: 'Bismillah' },
        {
          resource_id: 'kyrgyz_hakimov',
          resource_name: 'Kyrgyz — Shamsuddin Hakimov',
          text: 'Кыргызча',
          verse_key: '1:1',
          verse_number: 1,
        },
      ]);
    });

    it('collects chapter ids from verse payloads', () => {
      expect(
        collectChapterIdsFromVersesPayload({
          verses: [
            { chapter_id: 1, verse_number: 1 },
            { chapter_id: 2, verse_number: 255 },
            { chapter_id: 1, verse_number: 7 },
          ],
        }),
      ).toEqual([1, 2]);
    });
  });
});
