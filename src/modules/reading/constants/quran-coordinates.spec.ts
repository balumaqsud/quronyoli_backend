import { TOTAL_QURAN_AYAHS, isValidAyahCoordinate } from './quran-coordinates';

describe('quran-coordinates', () => {
  it('uses the canonical Quran ayah total', () => {
    expect(TOTAL_QURAN_AYAHS).toBe(6236);
  });

  it('validates chapter and verse bounds', () => {
    expect(isValidAyahCoordinate(1, 7)).toBe(true);
    expect(isValidAyahCoordinate(1, 8)).toBe(false);
    expect(isValidAyahCoordinate(2, 255)).toBe(true);
    expect(isValidAyahCoordinate(114, 6)).toBe(true);
    expect(isValidAyahCoordinate(114, 7)).toBe(false);
  });
});
