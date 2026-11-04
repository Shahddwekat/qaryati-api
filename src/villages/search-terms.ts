/**
 * Turns free text into a MySQL FULLTEXT boolean-mode query.
 *
 * - Boolean-mode operators (+ - < > ( ) ~ * " @) are removed, so user input can
 *   never change the meaning of the query.
 * - Every word must match (+) and may be a prefix (*), so "سبس" finds "سبسطية"
 *   and "Burq" finds "Burqa".
 * - Words shorter than MySQL's minimum token size (3) are dropped, because the
 *   full-text index does not contain them.
 *
 * Returns null when nothing searchable is left.
 */
export const MIN_TOKEN_LENGTH = 3;
const MAX_TERMS = 5;

export function toBooleanQuery(text: string): string | null {
  const terms = text
    .normalize('NFC')
    .replace(/[+\-<>()~*"@]/g, ' ')
    .split(/\s+/)
    .filter((t) => [...t].length >= MIN_TOKEN_LENGTH)
    .slice(0, MAX_TERMS);

  return terms.length ? terms.map((t) => `+${t}*`).join(' ') : null;
}
