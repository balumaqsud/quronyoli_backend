export type QuranEncAyahRow = {
  sura: number;
  aya: number;
  translation: string;
  footnotes: string;
};

/** QF-compatible snake_case translation row for clients. */
export type NormalizedEncTranslationRow = {
  resource_id: string;
  resource_name: string;
  text: string;
  verse_key: string;
  verse_number: number;
  footnotes?: string;
  id?: number | string;
};

export function assertValidSurahNumber(surah: number): void {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new Error(`Invalid surah number: ${surah}`);
  }
}

export function assertValidAyahNumber(ayah: number): void {
  if (!Number.isInteger(ayah) || ayah < 1) {
    throw new Error(`Invalid ayah number: ${ayah}`);
  }
}

export function parseEncAyahRow(raw: unknown): QuranEncAyahRow | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const sura = Number(row.sura);
  const aya = Number(row.aya);
  if (!Number.isFinite(sura) || !Number.isFinite(aya)) {
    return null;
  }
  const translation =
    typeof row.translation === 'string' ? row.translation : '';
  const footnotes = typeof row.footnotes === 'string' ? row.footnotes : '';
  return { sura, aya, translation, footnotes };
}

export function toNormalizedEncTranslationRow(
  row: QuranEncAyahRow,
  resourceId: string,
  resourceName: string,
): NormalizedEncTranslationRow {
  const normalized: NormalizedEncTranslationRow = {
    resource_id: resourceId,
    resource_name: resourceName,
    text: row.translation,
    verse_key: `${row.sura}:${row.aya}`,
    verse_number: row.aya,
  };
  if (row.footnotes) {
    normalized.footnotes = row.footnotes;
  }
  return normalized;
}
