/**
 * Correctly parse optional boolean query/body values.
 * Avoid `@Type(() => Boolean)` which turns the string "false" into true.
 */
export function toOptionalBoolean({
  value,
}: {
  value: unknown;
}): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
  return undefined;
}
