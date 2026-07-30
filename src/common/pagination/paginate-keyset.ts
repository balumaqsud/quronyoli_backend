import { decodeKeysetCursor, encodeKeysetCursor } from './keyset-cursor';

export interface KeysetPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface KeysetPageOptions<TRow> {
  limit: number;
  cursor?: string;
  /** Timestamp field used for the cursor (ISO string via toISOString). */
  getCursorAt: (row: TRow) => Date;
  getCursorId: (row: TRow) => string;
  mapItem: (row: TRow) => unknown;
}

/**
 * Standard keyset page shaping: fetch limit+1 rows, trim, encode next cursor.
 */
export function toKeysetPage<TRow, TItem>(
  rows: TRow[],
  options: {
    limit: number;
    getCursorAt: (row: TRow) => Date;
    getCursorId: (row: TRow) => string;
    mapItem: (row: TRow) => TItem;
  },
): KeysetPage<TItem> {
  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;
  const last = page[page.length - 1];

  return {
    items: page.map((row) => options.mapItem(row)),
    nextCursor:
      hasMore && last
        ? encodeKeysetCursor({
            at: options.getCursorAt(last).toISOString(),
            id: options.getCursorId(last),
          })
        : null,
  };
}

export function parseKeysetCursor(cursor?: string): {
  cursorAt?: Date;
  cursorId?: string;
} {
  if (!cursor) {
    return {};
  }
  const decoded = decodeKeysetCursor(cursor);
  return {
    cursorAt: new Date(decoded.at),
    cursorId: decoded.id,
  };
}
