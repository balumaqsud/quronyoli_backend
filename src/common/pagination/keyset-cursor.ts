import { BadRequestException } from '@nestjs/common';

export interface KeysetCursor {
  at: string;
  id: string;
}

export function encodeKeysetCursor(cursor: KeysetCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeKeysetCursor(raw: string): KeysetCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as KeysetCursor;

    if (
      typeof parsed.at !== 'string' ||
      typeof parsed.id !== 'string' ||
      Number.isNaN(Date.parse(parsed.at))
    ) {
      throw new Error('invalid cursor');
    }

    return parsed;
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
}
