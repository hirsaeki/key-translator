/**
 * Escapes a string for use inside a JSON double-quoted string.
 * Uses JSON.stringify to ensure all necessary characters are correctly escaped,
 * then removes the surrounding quotes added by JSON.stringify.
 */
export function escapeJsonString(text: string): string {
  // JSON.stringify adds quotes around the string, so we remove them.
  // It correctly handles all necessary JSON escaping rules.
  return JSON.stringify(text).slice(1, -1);
}
