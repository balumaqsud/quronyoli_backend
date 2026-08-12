import { encodeKeysetCursor, decodeKeysetCursor } from './keyset-cursor';
import {
  keysetDescCursorOr,
  parseKeysetCursor,
  toKeysetPage,
} from './paginate-keyset';

describe('keyset pagination helpers', () => {
  it('round-trips cursor encode/decode', () => {
    const encoded = encodeKeysetCursor({
      at: '2026-07-30T12:00:00.000Z',
      id: 'abc',
    });
    expect(decodeKeysetCursor(encoded)).toEqual({
      at: '2026-07-30T12:00:00.000Z',
      id: 'abc',
    });
  });

  it('shapes a page with nextCursor when overflow rows exist', () => {
    const rows = [
      { id: '1', createdAt: new Date('2026-07-01T00:00:00.000Z'), value: 'a' },
      { id: '2', createdAt: new Date('2026-07-02T00:00:00.000Z'), value: 'b' },
      { id: '3', createdAt: new Date('2026-07-03T00:00:00.000Z'), value: 'c' },
    ];

    const page = toKeysetPage(rows, {
      limit: 2,
      getCursorAt: (row) => row.createdAt,
      getCursorId: (row) => row.id,
      mapItem: (row) => row.value,
    });

    expect(page.items).toEqual(['a', 'b']);
    expect(page.nextCursor).toBe(
      encodeKeysetCursor({
        at: '2026-07-02T00:00:00.000Z',
        id: '2',
      }),
    );
  });

  it('returns null nextCursor on the final page', () => {
    const rows = [{ id: '1', createdAt: new Date('2026-07-01T00:00:00.000Z') }];
    const page = toKeysetPage(rows, {
      limit: 2,
      getCursorAt: (row) => row.createdAt,
      getCursorId: (row) => row.id,
      mapItem: (row) => row.id,
    });
    expect(page.nextCursor).toBeNull();
  });

  it('parses optional cursor into repository bounds', () => {
    expect(parseKeysetCursor(undefined)).toEqual({});
    const encoded = encodeKeysetCursor({
      at: '2026-07-30T12:00:00.000Z',
      id: 'x',
    });
    const parsed = parseKeysetCursor(encoded);
    expect(parsed.cursorId).toBe('x');
    expect(parsed.cursorAt?.toISOString()).toBe('2026-07-30T12:00:00.000Z');
  });

  it('builds a descending keyset cursor OR predicate', () => {
    const at = new Date('2026-07-02T00:00:00.000Z');
    expect(keysetDescCursorOr('createdAt', at, 'abc')).toEqual({
      OR: [
        { createdAt: { lt: at } },
        { AND: [{ createdAt: at }, { id: { lt: 'abc' } }] },
      ],
    });
  });
});
