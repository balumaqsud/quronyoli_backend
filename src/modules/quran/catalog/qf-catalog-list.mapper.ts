import {
  QuranReciter,
  QuranTranslation,
} from '../../../generated/prisma';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function resourceId(externalId: string): number | string {
  const numeric = Number(externalId);
  return Number.isFinite(numeric) ? numeric : externalId;
}

/**
 * Build a QF-shaped catalog resource from a local row.
 * Prefer stored upstream metadata so Mini App field names stay compatible.
 */
export function toQfTranslationResource(
  row: QuranTranslation,
): Record<string, unknown> {
  const meta = asRecord(row.metadata);
  if (meta) {
    const { source: _source, ...rest } = meta;
    return {
      ...rest,
      id: resourceId(row.externalId),
    };
  }

  return {
    id: resourceId(row.externalId),
    name: row.name,
    author_name: row.authorName,
    slug: row.slug,
    language_name: row.languageCode,
  };
}

export function toQfReciterResource(
  row: QuranReciter,
): Record<string, unknown> {
  const meta = asRecord(row.metadata);
  if (meta) {
    const { source: _source, ...rest } = meta;
    return {
      ...rest,
      id: resourceId(row.externalId),
    };
  }

  return {
    id: resourceId(row.externalId),
    name: row.name,
    reciter_name: row.name,
    arabic_name: row.arabicName,
    style: row.style,
    slug: row.slug,
  };
}
