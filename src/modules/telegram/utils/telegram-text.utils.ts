export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export interface ParsedAyahDeepLink {
  chapterNumber: number;
  verseNumber: number;
  verseKey: string;
}

const AYAH_START_PATTERN = /^ayah_(\d{1,3})_(\d{1,3})$/i;

export function parseAyahStartPayload(
  payload: string | undefined,
): ParsedAyahDeepLink | null {
  if (!payload) {
    return null;
  }

  const match = AYAH_START_PATTERN.exec(payload.trim());
  if (!match) {
    return null;
  }

  const chapterNumber = Number.parseInt(match[1], 10);
  const verseNumber = Number.parseInt(match[2], 10);
  return {
    chapterNumber,
    verseNumber,
    verseKey: `${chapterNumber}:${verseNumber}`,
  };
}

export function buildAyahStartPayload(
  chapterNumber: number,
  verseNumber: number,
): string {
  return `ayah_${chapterNumber}_${verseNumber}`;
}
