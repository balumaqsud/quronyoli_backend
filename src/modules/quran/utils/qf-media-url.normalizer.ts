/**
 * Normalize Quran.Foundation media URLs in proxied JSON payloads.
 * - Protocol-relative image_url → https:
 * - Relative ayah audio url → absolute using audio CDN base
 * Leaves already-absolute URLs unchanged.
 */
export function normalizeQfMediaUrls(
  payload: unknown,
  audioCdnBase: string,
): unknown {
  const base = audioCdnBase.replace(/\/$/, '');
  return walk(payload, base);
}

function walk(value: unknown, audioCdnBase: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, audioCdnBase));
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(input)) {
    if (key === 'image_url' && typeof child === 'string') {
      output[key] = normalizeProtocolRelative(child);
      continue;
    }

    if (
      (key === 'url' || key === 'audio_url') &&
      typeof child === 'string' &&
      isRelativeMediaPath(child)
    ) {
      output[key] = `${audioCdnBase}/${child.replace(/^\//, '')}`;
      continue;
    }

    output[key] = walk(child, audioCdnBase);
  }

  return output;
}

function normalizeProtocolRelative(url: string): string {
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  return url;
}

function isRelativeMediaPath(url: string): boolean {
  if (!url || url.startsWith('http://') || url.startsWith('https://')) {
    return false;
  }
  if (url.startsWith('//') || url.startsWith('data:')) {
    return false;
  }
  return true;
}
