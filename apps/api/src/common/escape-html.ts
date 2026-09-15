/**
 * HTML entity encoding for untrusted values interpolated into email bodies.
 *
 * Escape at the point of output rather than stripping tags at ingest. A
 * tag-stripping regex only matches *complete* tags, so an unterminated
 * `<a href="..." x="` survives and the surrounding template supplies the `>`;
 * it also mangles legitimate text such as "cost < value". Escaping keeps the
 * stored value exactly as typed and renders it inert wherever it lands.
 *
 * `&` must be replaced first, or the entities added afterwards get
 * double-encoded.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Collapse CR/LF so an untrusted value can't start a new line in a header such as Subject. */
export function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
