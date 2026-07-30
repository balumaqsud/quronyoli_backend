import { Prisma } from '../../../generated/prisma';
import { QURAN_FOUNDATION_PROVIDER } from '../../settings/interfaces/settings.interface';

const LANGUAGE_CODE_MAP: Record<string, string> = {
  english: 'en',
  arabic: 'ar',
  russian: 'ru',
  uzbek: 'uz',
  french: 'fr',
  bengali: 'bn',
  turkish: 'tr',
  urdu: 'ur',
  indonesian: 'id',
  malay: 'ms',
  persian: 'fa',
  farsi: 'fa',
  german: 'de',
  spanish: 'es',
  portuguese: 'pt',
  dutch: 'nl',
  italian: 'it',
  chinese: 'zh',
  japanese: 'ja',
  korean: 'ko',
  hindi: 'hi',
  swedish: 'sv',
  tamil: 'ta',
  albanian: 'sq',
  azeri: 'az',
  bosnian: 'bs',
  czech: 'cs',
  danish: 'da',
  finnish: 'fi',
  greek: 'el',
  hebrew: 'he',
  kurdish: 'ku',
  norwegian: 'no',
  polish: 'pl',
  romanian: 'ro',
  somali: 'so',
  swahili: 'sw',
  thai: 'th',
  vietnamese: 'vi',
};

export type CatalogTranslationPayload = {
  provider: string;
  externalId: string;
  languageCode: string;
  name: string;
  authorName: string | null;
  slug: string | null;
  isActive: boolean;
  deletedAt: null;
  metadata: Prisma.InputJsonValue;
};

export type CatalogTafsirPayload = CatalogTranslationPayload;

export type CatalogReciterPayload = {
  provider: string;
  externalId: string;
  name: string;
  arabicName: string | null;
  style: string | null;
  slug: string | null;
  isActive: boolean;
  deletedAt: null;
  metadata: Prisma.InputJsonValue;
};

export function mapLanguageNameToCode(languageName: unknown): string {
  if (typeof languageName !== 'string' || languageName.trim() === '') {
    return 'und';
  }

  const normalized = languageName.trim().toLowerCase();
  if (LANGUAGE_CODE_MAP[normalized]) {
    return LANGUAGE_CODE_MAP[normalized];
  }

  if (/^[a-z]{2}(-[a-z0-9]+)?$/i.test(normalized)) {
    return normalized.slice(0, 16).toLowerCase();
  }

  return normalized.replace(/[^a-z0-9-]/g, '').slice(0, 16) || 'und';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return asString(value);
}

function requireId(raw: Record<string, unknown>): string {
  const id = raw.id;
  if (typeof id === 'number' && Number.isFinite(id)) {
    return String(id);
  }
  if (typeof id === 'string' && id.trim() !== '') {
    return id.trim();
  }
  throw new Error('Catalog resource is missing a numeric id');
}

function resolveTranslatedName(
  raw: Record<string, unknown>,
): Record<string, unknown> | null {
  return asRecord(raw.translated_name) ?? asRecord(raw.translatedName);
}

export function mapTranslationResource(
  rawInput: unknown,
): CatalogTranslationPayload {
  const raw = asRecord(rawInput);
  if (!raw) {
    throw new Error('Translation resource must be an object');
  }

  const name = asString(raw.name);
  if (!name) {
    throw new Error(`Translation ${String(raw.id)} is missing name`);
  }

  const languageName = raw.language_name ?? raw.languageName;

  return {
    provider: QURAN_FOUNDATION_PROVIDER,
    externalId: requireId(raw),
    languageCode: mapLanguageNameToCode(languageName),
    name,
    authorName: asNullableString(raw.author_name ?? raw.authorName),
    slug: asNullableString(raw.slug),
    isActive: true,
    deletedAt: null,
    metadata: raw as Prisma.InputJsonValue,
  };
}

export function mapTafsirResource(rawInput: unknown): CatalogTafsirPayload {
  return mapTranslationResource(rawInput);
}

export function mapRecitationResource(
  rawInput: unknown,
): CatalogReciterPayload {
  const raw = asRecord(rawInput);
  if (!raw) {
    throw new Error('Recitation resource must be an object');
  }

  const nestedName = asRecord(raw.name);
  const translated = resolveTranslatedName(raw);
  const name =
    asString(raw.reciter_name) ??
    asString(raw.reciterName) ??
    asString(raw.name) ??
    asString(nestedName?.name) ??
    asString(translated?.name);

  if (!name) {
    throw new Error(`Recitation ${String(raw.id)} is missing name`);
  }

  const styleRaw = raw.style;
  const style =
    typeof styleRaw === 'string'
      ? asString(styleRaw)
      : asString(asRecord(styleRaw)?.name);

  const arabicName =
    translated &&
    typeof translated.language_name === 'string' &&
    translated.language_name.toLowerCase() === 'arabic'
      ? asString(translated.name)
      : asNullableString(raw.arabic_name ?? raw.arabicName);

  return {
    provider: QURAN_FOUNDATION_PROVIDER,
    externalId: requireId(raw),
    name,
    arabicName,
    style,
    slug: asNullableString(raw.slug),
    isActive: true,
    deletedAt: null,
    metadata: {
      ...raw,
      source: 'recitations',
    },
  };
}

export function extractResourceList(
  payload: unknown,
  keys: string[],
): unknown[] {
  const record = asRecord(payload);
  if (!record) {
    throw new Error('Catalog response must be an object');
  }

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  throw new Error(`Catalog response missing list field (${keys.join(' | ')})`);
}
