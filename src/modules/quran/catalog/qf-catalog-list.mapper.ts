import {
  QuranReciter,
  QuranTafsir,
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

/** Drop internal sync `source` marker from stored QF metadata before API output. */
function omitSource(meta: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...meta };
  delete rest.source;
  return rest;
}

/**
 * Build a QF-shaped catalog resource from a local row.
 * Prefer stored upstream metadata so Mini App field names stay compatible.
 * Admin gating fields (is_default / is_popular / sort_order) are always attached.
 */
export function toQfTranslationResource(
  row: QuranTranslation,
): Record<string, unknown> {
  const meta = asRecord(row.metadata);
  const adminFields = {
    is_default: row.isDefault,
    sort_order: row.sortOrder,
  };

  if (meta) {
    const rest = omitSource(meta);
    return {
      ...rest,
      id: resourceId(row.externalId),
      language_name: rest.language_name ?? row.languageCode,
      provider: row.provider,
      ...adminFields,
    };
  }

  return {
    id: resourceId(row.externalId),
    name: row.name,
    author_name: row.authorName,
    slug: row.slug,
    language_name: row.languageCode,
    provider: row.provider,
    ...adminFields,
  };
}

export function toQfTafsirResource(row: QuranTafsir): Record<string, unknown> {
  const meta = asRecord(row.metadata);
  const adminFields = {
    sort_order: row.sortOrder,
  };

  if (meta) {
    const rest = omitSource(meta);
    return {
      ...rest,
      id: resourceId(row.externalId),
      ...adminFields,
    };
  }

  return {
    id: resourceId(row.externalId),
    name: row.name,
    author_name: row.authorName,
    slug: row.slug,
    language_name: row.languageCode,
    ...adminFields,
  };
}

export function toQfReciterResource(
  row: QuranReciter,
): Record<string, unknown> {
  const meta = asRecord(row.metadata);
  const adminFields = {
    is_popular: row.isPopular,
    sort_order: row.sortOrder,
  };

  if (meta) {
    const rest = omitSource(meta);
    return {
      ...rest,
      id: resourceId(row.externalId),
      ...adminFields,
    };
  }

  return {
    id: resourceId(row.externalId),
    name: row.name,
    reciter_name: row.name,
    arabic_name: row.arabicName,
    style: row.style,
    slug: row.slug,
    ...adminFields,
  };
}
