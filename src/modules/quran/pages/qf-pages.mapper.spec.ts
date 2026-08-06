import {
  applyPageImageMeta,
  mapVersesToMushafPage,
  surahIdFromVerseKey,
  toMushafPageDetail,
  toMushafPageListItem,
} from './qf-pages.mapper';
import { buildTajweedPageImageUrl } from './qf-page-images';

describe('qf-pages.mapper', () => {
  it('parses surah id from verse key', () => {
    expect(surahIdFromVerseKey('1:1')).toBe(1);
    expect(surahIdFromVerseKey('114:6')).toBe(114);
    expect(surahIdFromVerseKey('bad')).toBeNull();
  });

  it('maps verses to mushaf page metadata without storing text or verse images', () => {
    const payload = mapVersesToMushafPage(1, 1, [
      {
        verse_key: '1:1',
        juz_number: 1,
        hizb_number: 1,
        rub_el_hizb_number: 1,
        page_number: 1,
        image_url: '//cdn.example/1_1.png',
        image_width: 675,
      },
      {
        verse_key: '1:7',
        juz_number: 1,
        hizb_number: 1,
        rub_el_hizb_number: 1,
        page_number: 1,
      },
    ]);

    expect(payload.firstVerseKey).toBe('1:1');
    expect(payload.lastVerseKey).toBe('1:7');
    expect(payload.verseKeys).toEqual(['1:1', '1:7']);
    expect(payload.surahIds).toEqual([1]);
    expect(payload.verseCount).toBe(2);
    expect(payload.imageUrl).toBeNull();
    expect(payload.imageWidth).toBeNull();
    expect(JSON.stringify(payload)).not.toMatch(/بِسْم/);
  });

  it('applies Dar al-Marefa full-page image URLs for mushaf 10', () => {
    const payload = mapVersesToMushafPage(596, 10, [
      {
        verse_key: '93:1',
        juz_number: 30,
        hizb_number: 60,
        rub_el_hizb_number: 238,
      },
    ]);
    const withImage = applyPageImageMeta(payload);
    expect(withImage.imageUrl).toBe(buildTajweedPageImageUrl(596));
    expect(withImage.imageWidth).toBe(776);
  });

  it('collects multi-juz and multi-surah sets', () => {
    const payload = mapVersesToMushafPage(2, 1, [
      {
        verse_key: '2:1',
        juz_number: 1,
        hizb_number: 1,
        rub_el_hizb_number: 1,
      },
      {
        verse_key: '2:141',
        juz_number: 2,
        hizb_number: 3,
        rub_el_hizb_number: 9,
      },
    ]);

    expect(payload.juzNumber).toBe(1);
    expect(payload.juzNumbers).toEqual([1, 2]);
    expect(payload.hizbNumbers).toEqual([1, 3]);
    expect(payload.rubElHizbNumbers).toEqual([1, 9]);
    expect(payload.surahIds).toEqual([2]);
  });

  it('serializes list and detail API shapes in camelCase', () => {
    const syncedAt = new Date('2026-08-01T00:00:00.000Z');
    const row = {
      mushafId: 1,
      pageNumber: 1,
      firstVerseKey: '1:1',
      lastVerseKey: '1:7',
      verseKeys: ['1:1', '1:7'],
      surahIds: [1],
      juzNumber: 1,
      hizbNumber: 1,
      rubElHizbNumber: 1,
      juzNumbers: [1],
      hizbNumbers: [1],
      rubElHizbNumbers: [1],
      verseCount: 2,
      imageUrl: null,
      imageWidth: null,
      syncedAt,
    };

    expect(toMushafPageListItem(row)).toEqual({
      page: 1,
      firstVerse: '1:1',
      lastVerse: '1:7',
      verseCount: 2,
    });

    expect(toMushafPageDetail(row)).toMatchObject({
      pageNumber: 1,
      mushafId: 1,
      rubElHizb: 1,
      verseCount: 2,
      verses: ['1:1', '1:7'],
      syncedAt: syncedAt.toISOString(),
    });
  });
});
