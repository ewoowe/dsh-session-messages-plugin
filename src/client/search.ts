/**
 * Message search over the list the overlay collected.
 *
 * Scope is the honest constraint, and it decides everything below: the host
 * exposes no in-session search a client plugin can use. `ctx.sessions.search` is
 * cross-session and answers with one best snippet per SESSION and no message
 * anchor (`SessionSearchItem` is `{ sessionId, snippet }`), and the granularity
 * that would fit — `sessionQuery.searchEvents`, whose hits carry `seq` — exists
 * only on the host side, with no remote endpoint. So the corpus is the collected
 * list, i.e. what the dialog already shows, and the header states how much that
 * was.
 *
 * Everything here is pure: no DOM, no React, no clock. Matching is where the
 * edges are, and they are worth testing without any of those.
 */

/** A half-open `[start, end)` range into a string, in UTF-16 code units. */
export interface MatchRange {
  readonly start: number
  readonly end: number
}

/**
 * The display form of a string: Unicode NFC, case preserved.
 *
 * NFC is not optional for this plugin. A Japanese `が` typed on an IME reaches
 * the DOM as one code point on some input methods and as `か` plus a combining
 * voiced mark on others, so the same visible message can compare unequal to
 * itself — a match the reader can see but cannot find. Folding both sides is what
 * makes the two spellings one string.
 *
 * It is also what keeps offsets honest: NFC and NFD draw identically, so this is
 * safe to RENDER, and ranges computed over it land on the characters on screen.
 * `splitEntry` already stores message text this way; folding again is idempotent.
 * @param text - text to fold.
 * @returns the display form.
 */
export function nfc(text: string): string {
  return text.normalize('NFC')
}

/**
 * The matching form: {@link nfc}, lowercased.
 *
 * Lowercasing is deliberately locale-independent (`toLowerCase`, not
 * `toLocaleLowerCase`): whether `I` matches `i` must not depend on the language
 * the UI happens to be showing.
 *
 * Never render this — it loses case. It exists to be searched, and pairs with
 * {@link nfc} for display.
 * @param text - text to fold.
 * @returns the matching form.
 */
export function normalize(text: string): string {
  return nfc(text).toLowerCase()
}

/**
 * Whether a query would filter anything. A blank one means "no search running",
 * not "match nothing".
 * @param query - raw query text.
 * @returns true when the query carries no searchable characters.
 */
export function isBlankQuery(query: string): boolean {
  return normalize(query).trim() === ''
}

/**
 * Every occurrence of `query` in `text`, as ranges into {@link nfc}`(text)`.
 *
 * Plain substring, never a pattern: a reader typing `(` or `[` is typing
 * characters from a message, not a regular expression, and an unparseable query
 * would be a failure they cannot fix by typing more.
 * @param text - the text to search.
 * @param query - raw query text; blank matches nothing.
 * @returns ranges into the DISPLAY form of `text`, left to right, non-overlapping.
 */
export function matchRanges(text: string, query: string): readonly MatchRange[] {
  if (isBlankQuery(query)) return []
  const needle = normalize(query).trim()
  const display = nfc(text)
  const haystack = display.toLowerCase()
  // Folding case can change a string's length — `İ` lowercases to two code points
  // — which would shift every offset after it. No locale this plugin ships hits
  // that, but a mis-placed highlight is silent, so it is checked rather than
  // assumed: mismatched lengths mean no highlight at all.
  if (haystack.length !== display.length) return []
  const ranges: MatchRange[] = []
  let at = haystack.indexOf(needle)
  // Advance past each hit rather than by one: overlapping occurrences of the
  // same needle are one match, which is what a reader counts them as.
  while (at !== -1) {
    ranges.push({ start: at, end: at + needle.length })
    at = haystack.indexOf(needle, at + needle.length)
  }
  return ranges
}

/** The part of a collected message that search reads. */
export interface SearchableEntry {
  /** The message text, as collected. */
  readonly text: string
  /** The clock label, or null when the row carries none. */
  readonly timestamp: string | null
}

/**
 * Whether one entry survives the query.
 *
 * The clock is searched alongside the text: "what did I send that day" is a
 * question this list should answer, and the label is already on the row.
 * @param entry - the collected message.
 * @param query - raw query text; blank keeps the entry.
 * @returns true when either field contains the query.
 */
export function matchesEntry(entry: SearchableEntry, query: string): boolean {
  if (isBlankQuery(query)) return true
  return matchRanges(entry.text, query).length > 0
    || (entry.timestamp !== null && matchRanges(entry.timestamp, query).length > 0)
}

/** One rendered preview: the string to show, and the ranges to highlight in it. */
export interface Highlighted {
  readonly text: string
  readonly ranges: readonly MatchRange[]
}

/**
 * Context kept in front of a match the window had to move for. A quarter of the
 * budget is enough to recognise the sentence the hit sits in, and leaves the
 * rest for what follows it.
 */
const LEAD_RATIO = 0.25

/**
 * The excerpt a row shows while a search is running.
 *
 * The preview is clamped to two lines, so a hit past the opening characters
 * would otherwise be counted and highlighted but never visible: the reader gets
 * a row marked as a hit with no reason on screen. When the match falls outside
 * the opening window, this slides the window onto it and marks each cut end with
 * an ellipsis.
 *
 * With a blank query this degrades to the plain head slice the list shows when
 * no search is running, so the row has one code path either way.
 * @param text - the message text.
 * @param query - raw query text.
 * @param maxChars - budget for the message body; the ellipses are not counted.
 * @returns the string to render, and the ranges to highlight inside it.
 */
export function highlight(text: string, query: string, maxChars: number): Highlighted {
  // The display form, not the matching form: this string is rendered, so it keeps
  // its case. `matchRanges` returns offsets into exactly this string.
  const body = nfc(text)
  const ranges = matchRanges(text, query)
  const first = ranges[0]
  if (first === undefined) return { text: body.slice(0, maxChars), ranges: [] }

  const lead = Math.floor(maxChars * LEAD_RATIO)
  // The match already inside the opening window keeps the head of the message,
  // which is the context a reader expects; only a later hit moves the window.
  let start = first.end <= maxChars ? 0 : Math.max(0, first.start - lead)
  let end = start + maxChars
  if (first.end > end) {
    // A match longer than the budget: anchor on its tail, so its beginning is
    // cut rather than the whole hit falling outside.
    start = Math.max(0, first.end - maxChars)
    end = start + maxChars
  }
  end = Math.min(end, body.length)

  const prefix = start > 0 ? '…' : ''
  const suffix = end < body.length ? '…' : ''
  const rendered = prefix + body.slice(start, end) + suffix
  const shift = prefix.length - start
  // Clamped to the body's span, not the whole rendered string: a range reaching
  // past either cut would otherwise emphasise the ellipsis that stands for the
  // text it did NOT match.
  const bodyStart = prefix.length
  const bodyEnd = rendered.length - suffix.length
  return {
    text: rendered,
    ranges: ranges
      .map(range => ({
        start: Math.max(bodyStart, range.start + shift),
        end: Math.min(bodyEnd, range.end + shift),
      }))
      .filter(range => range.end > range.start),
  }
}
