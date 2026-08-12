/**
 * Normalize Quran.Foundation media URLs in proxied JSON payloads.
 * - Protocol-relative image_url → https:
 * - Relative ayah audio url → absolute using audio CDN base
 * Leaves already-absolute URLs unchanged.
 *
 * Uses clone-on-change: unchanged subtrees keep their original references
 * to avoid deep-copying large verse/word trees when no URLs need rewriting.
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
    let changed = false;
    const next = value.map((item) => {
      const walked = walk(item, audioCdnBase);
      if (walked !== item) {
        changed = true;
      }
      return walked;
    });
    return changed ? next : value;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  const input = value as Record<string, unknown>;
  let changed = false;
  const output: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(input)) {
    if (key === 'image_url' && typeof child === 'string') {
      const normalized = normalizeProtocolRelative(child);
      output[key] = normalized;
      if (normalized !== child) {
        changed = true;
      }
      continue;
    }

    if (
      (key === 'url' || key === 'audio_url') &&
      typeof child === 'string' &&
      isRelativeMediaPath(child)
    ) {
      output[key] = `${audioCdnBase}/${child.replace(/^\//, '')}`;
      changed = true;
      continue;
    }

    const walked = walk(child, audioCdnBase);
    output[key] = walked;
    if (walked !== child) {
      changed = true;
    }
  }

  return changed ? output : value;
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
