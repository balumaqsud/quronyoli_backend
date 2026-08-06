/** Verified mushaf IDs from Quran.Foundation font docs + live probes (no upstream catalog). */
export type MushafResource = {
  id: number;
  name: string;
  /** Stable preference / book-mode key when present. */
  key?: string;
  apiField: string;
  type: 'glyph' | 'unicode' | 'image';
  bestFor: string;
  pagesCount?: number;
};

export const QF_MUSHAF_RESOURCES: MushafResource[] = [
  {
    id: 1,
    name: 'QCF V2',
    apiField: 'code_v2',
    type: 'glyph',
    bestFor: 'Modern Madani Mushaf (recommended)',
  },
  {
    id: 2,
    name: 'QCF V1',
    apiField: 'code_v1',
    type: 'glyph',
    bestFor: 'Traditional Madani Mushaf look',
  },
  {
    id: 3,
    name: 'IndoPak',
    apiField: 'text_indopak',
    type: 'unicode',
    bestFor: 'South Asian users',
  },
  {
    id: 4,
    name: 'Uthmani',
    key: 'uthmani',
    apiField: 'text_uthmani',
    type: 'unicode',
    bestFor: 'Standard Uthmani text',
  },
  {
    id: 5,
    name: 'QPC Hafs',
    apiField: 'text_qpc_hafs',
    type: 'unicode',
    bestFor: 'UthmanicHafs Unicode font family',
  },
  {
    id: 6,
    name: 'IndoPak (variant)',
    apiField: 'text_indopak',
    type: 'unicode',
    bestFor: 'South Asian users',
  },
  {
    id: 7,
    name: 'IndoPak (variant)',
    apiField: 'text_indopak',
    type: 'unicode',
    bestFor: 'South Asian users',
  },
  {
    id: 10,
    name: 'Uthmani Tajweed Images',
    key: 'uthmani-tajweed-images',
    apiField: 'img',
    type: 'image',
    bestFor: 'Dar al-Marefa full-page Tajweed mushaf images',
    pagesCount: 604,
  },
  {
    id: 19,
    name: 'QCF V4 Tajweed',
    apiField: 'code_v2',
    type: 'glyph',
    bestFor: 'Colored Tajweed glyph fonts',
  },
];

export const QF_MUSHAF_IDS = QF_MUSHAF_RESOURCES.map((m) => m.id);

export function isQfMushafId(value: number): boolean {
  return QF_MUSHAF_IDS.includes(value);
}

export const QF_SCRIPT_WHITELIST = [
  'uthmani',
  'uthmani_tajweed',
  'uthmani_simple',
  'imlaei',
  'indopak',
  'indopak_nastaleeq',
  'code_v1',
  'code_v2',
  'qpc_hafs',
] as const;

export type QfScriptName = (typeof QF_SCRIPT_WHITELIST)[number];

export function isQfScriptName(value: string): value is QfScriptName {
  return (QF_SCRIPT_WHITELIST as readonly string[]).includes(value);
}
