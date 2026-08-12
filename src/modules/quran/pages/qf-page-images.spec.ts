import {
  buildPageImageUrl,
  buildTajweedPageImageUrl,
  CLASSIC_MADINA_1405_IMAGE_WIDTH,
  CLASSIC_MADINA_1405_MUSHAF_ID,
  DEFAULT_TAJWEED_PAGE_IMAGE_BASE,
  DEFAULT_TAJWEED_PAGE_IMAGE_EXT,
  isImageMushafId,
  isLikelyVerseStripImageUrl,
  mushafNeedsOwnLayoutSync,
  resolvePageImageUrlConfig,
  TAJWEED_PAGE_IMAGE_WIDTH,
  UTHMANI_TAJWEED_IMAGES_MUSHAF_ID,
} from './qf-page-images';

describe('qf-page-images', () => {
  it('builds non-padded webp page URLs (mushaf 10 defaults)', () => {
    expect(buildTajweedPageImageUrl(1)).toBe(
      `${DEFAULT_TAJWEED_PAGE_IMAGE_BASE}/1.${DEFAULT_TAJWEED_PAGE_IMAGE_EXT}`,
    );
    expect(buildTajweedPageImageUrl(593)).toBe(
      `${DEFAULT_TAJWEED_PAGE_IMAGE_BASE}/593.${DEFAULT_TAJWEED_PAGE_IMAGE_EXT}`,
    );
    expect(buildPageImageUrl(1)).toBe(buildTajweedPageImageUrl(1));
  });

  it('trims trailing slash on base', () => {
    expect(
      buildTajweedPageImageUrl(2, {
        baseUrl: `${DEFAULT_TAJWEED_PAGE_IMAGE_BASE}/`,
        extension: 'webp',
      }),
    ).toBe(`${DEFAULT_TAJWEED_PAGE_IMAGE_BASE}/2.webp`);
  });

  it('detects verse-strip rackcdn URLs', () => {
    expect(
      isLikelyVerseStripImageUrl('https://c22506.r6.cf1.rackcdn.com/91_1.png'),
    ).toBe(true);
    expect(
      isLikelyVerseStripImageUrl(`${DEFAULT_TAJWEED_PAGE_IMAGE_BASE}/593.webp`),
    ).toBe(false);
  });

  it('identifies image editions and layout sync rules', () => {
    expect(isImageMushafId(UTHMANI_TAJWEED_IMAGES_MUSHAF_ID)).toBe(true);
    expect(isImageMushafId(CLASSIC_MADINA_1405_MUSHAF_ID)).toBe(true);
    expect(isImageMushafId(1)).toBe(false);
    expect(mushafNeedsOwnLayoutSync(UTHMANI_TAJWEED_IMAGES_MUSHAF_ID)).toBe(
      true,
    );
    expect(mushafNeedsOwnLayoutSync(CLASSIC_MADINA_1405_MUSHAF_ID)).toBe(false);
    expect(TAJWEED_PAGE_IMAGE_WIDTH).toBe(776);
    expect(CLASSIC_MADINA_1405_IMAGE_WIDTH).toBe(1024);
  });

  it('resolves mushaf 10 defaults when sources omit it', () => {
    const resolved = resolvePageImageUrlConfig(10);
    expect(resolved?.baseUrl).toBe(DEFAULT_TAJWEED_PAGE_IMAGE_BASE);
  });

  it('resolves mushaf 1405 only when base is non-empty', () => {
    expect(resolvePageImageUrlConfig(1405)).toBeUndefined();
    expect(
      resolvePageImageUrlConfig(1405, {
        bases: { 1405: { baseUrl: '', extension: 'webp' } },
      }),
    ).toBeUndefined();
    expect(
      resolvePageImageUrlConfig(1405, {
        bases: {
          1405: {
            baseUrl: 'https://api.example/uploads/mushaf/1405',
            extension: 'webp',
          },
        },
      }),
    ).toEqual({
      baseUrl: 'https://api.example/uploads/mushaf/1405',
      extension: 'webp',
      width: CLASSIC_MADINA_1405_IMAGE_WIDTH,
    });
  });
});
