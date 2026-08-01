import {
  extractResourceList,
  mapChapterReciterResource,
  mapLanguageNameToCode,
  mapRecitationResource,
  mapTafsirResource,
  mapTranslationResource,
} from './qf-catalog.mapper';

describe('qf-catalog.mapper', () => {
  describe('mapLanguageNameToCode', () => {
    it('maps known language names to ISO codes', () => {
      expect(mapLanguageNameToCode('english')).toBe('en');
      expect(mapLanguageNameToCode('Uzbek')).toBe('uz');
      expect(mapLanguageNameToCode('russian')).toBe('ru');
    });

    it('falls back for unknown languages', () => {
      expect(mapLanguageNameToCode('Klingon')).toBe('klingon');
      expect(mapLanguageNameToCode('')).toBe('und');
      expect(mapLanguageNameToCode(null)).toBe('und');
    });
  });

  describe('mapTranslationResource', () => {
    it('maps snake_case wire payload', () => {
      const mapped = mapTranslationResource({
        id: 131,
        name: 'Clear Quran',
        author_name: 'Dr. Mustafa Khattab',
        slug: 'clearquran-with-tafsir',
        language_name: 'english',
      });

      expect(mapped).toMatchObject({
        provider: 'quran.foundation',
        externalId: '131',
        languageCode: 'en',
        name: 'Clear Quran',
        authorName: 'Dr. Mustafa Khattab',
        slug: 'clearquran-with-tafsir',
        isActive: true,
        deletedAt: null,
      });
    });

    it('accepts camelCase and null author/slug', () => {
      const mapped = mapTranslationResource({
        id: '55',
        name: 'MSM Yusuf',
        authorName: null,
        slug: null,
        languageName: 'uzbek',
      });

      expect(mapped.externalId).toBe('55');
      expect(mapped.authorName).toBeNull();
      expect(mapped.slug).toBeNull();
      expect(mapped.languageCode).toBe('uz');
    });
  });

  describe('mapTafsirResource', () => {
    it('maps tafsir resources', () => {
      const mapped = mapTafsirResource({
        id: 169,
        name: 'Ibn Kathir (Abridged)',
        author_name: 'Hafiz Ibn Kathir',
        slug: 'en-tafisr-ibn-kathir',
        language_name: 'english',
      });

      expect(mapped.externalId).toBe('169');
      expect(mapped.languageCode).toBe('en');
    });
  });

  describe('mapRecitationResource', () => {
    it('maps reciter_name + string style', () => {
      const mapped = mapRecitationResource({
        id: 7,
        reciter_name: 'Mishari Rashid al-`Afasy',
        style: 'Murattal',
      });

      expect(mapped).toMatchObject({
        externalId: '7',
        kind: 'AYAH',
        name: 'Mishari Rashid al-`Afasy',
        style: 'Murattal',
        isActive: true,
      });
      expect(mapped.metadata).toMatchObject({ source: 'recitations' });
    });

    it('tolerates nested name/style objects', () => {
      const mapped = mapRecitationResource({
        id: 6,
        name: { name: 'Mahmoud Khalil Al-Husary', language_name: 'english' },
        style: { name: 'Muallim' },
      });

      expect(mapped.name).toBe('Mahmoud Khalil Al-Husary');
      expect(mapped.style).toBe('Muallim');
      expect(mapped.kind).toBe('AYAH');
    });
  });

  describe('mapChapterReciterResource', () => {
    it('maps chapter reciter with nested style', () => {
      const mapped = mapChapterReciterResource({
        id: 19,
        name: 'Ahmed ibn Ali al-Ajmy',
        style: { name: 'Murattal' },
      });

      expect(mapped).toMatchObject({
        externalId: '19',
        kind: 'CHAPTER',
        name: 'Ahmed ibn Ali al-Ajmy',
        style: 'Murattal',
      });
      expect(mapped.metadata).toMatchObject({ source: 'chapter_reciters' });
    });
  });

  describe('extractResourceList', () => {
    it('reads the first matching list key', () => {
      expect(
        extractResourceList({ translations: [{ id: 1 }] }, [
          'translations',
          'items',
        ]),
      ).toEqual([{ id: 1 }]);
    });

    it('throws when no list key is present', () => {
      expect(() => extractResourceList({ ok: true }, ['translations'])).toThrow(
        /missing list field/,
      );
    });
  });
});
