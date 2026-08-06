import {
  buildTajweedPageImageUrl,
  DEFAULT_TAJWEED_PAGE_IMAGE_BASE,
  DEFAULT_TAJWEED_PAGE_IMAGE_EXT,
  isImageMushafId,
  isLikelyVerseStripImageUrl,
  TAJWEED_PAGE_IMAGE_WIDTH,
  UTHMANI_TAJWEED_IMAGES_MUSHAF_ID,
} from './qf-page-images';

describe('qf-page-images', () => {
  it('builds non-padded webp page URLs', () => {
    expect(buildTajweedPageImageUrl(1)).toBe(
      `${DEFAULT_TAJWEED_PAGE_IMAGE_BASE}/1.${DEFAULT_TAJWEED_PAGE_IMAGE_EXT}`,
    );
    expect(buildTajweedPageImageUrl(593)).toBe(
      `${DEFAULT_TAJWEED_PAGE_IMAGE_BASE}/593.${DEFAULT_TAJWEED_PAGE_IMAGE_EXT}`,
    );
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
      isLikelyVerseStripImageUrl(
        'https://c22506.r6.cf1.rackcdn.com/91_1.png',
      ),
    ).toBe(true);
    expect(
      isLikelyVerseStripImageUrl(
        `${DEFAULT_TAJWEED_PAGE_IMAGE_BASE}/593.webp`,
      ),
    ).toBe(false);
  });

  it('identifies mushaf 10 as the image edition', () => {
    expect(isImageMushafId(UTHMANI_TAJWEED_IMAGES_MUSHAF_ID)).toBe(true);
    expect(isImageMushafId(1)).toBe(false);
    expect(TAJWEED_PAGE_IMAGE_WIDTH).toBe(776);
  });
});
