/**
 * The transcript DOM contract, in one place.
 *
 * A third-party plugin cannot reach `ui-chat`'s node store, so every read goes
 * through attributes `ChatView` resolves its OWN scroll anchors with. That is
 * what makes them contracts rather than internals — breaking one would break
 * the host first:
 *
 * - `[data-conversation-scroll]` — the scrollport (ChatView's own `scrollerOf`).
 * - `[data-chat-flow-kind="user"|"steering"]` — one human message row.
 * - `[data-chat-anchor-key]` — the row's identity (ChatView restores scroll
 *   position by it).
 * - `[data-chat-turn]` — the turn the row belongs to.
 * - `[data-turn-tail]` — that turn's tail, which seats the usage and duration
 *   pills.
 *
 * Both consumers read through here — the overlay's list and the viewport HUD —
 * so the contract, the timestamp pattern and the pill geometry live in exactly
 * one place instead of drifting apart.
 */

/**
 * The transcript's scrollport, or null when no conversation is mounted.
 *
 * Resolved from a message row UPWARD, the way the host resolves it for its own
 * scrolling (`ChatView`'s `scrollerOf`: the nearest enclosing
 * `[data-conversation-scroll]`, and the view itself when there is none).
 *
 * A document-wide `querySelector` — what this used to do — can land on a
 * DIFFERENT conversation's scrollport, because more than one can be mounted: a
 * settings page keeps a preview alive, and a hidden or shortened box used as "the
 * viewport" makes every geometric test meaningless. The symptoms are quiet
 * rather than loud: the strip names the row it happened to start on and never
 * follows the reader, and the dialog's "which row is visible" test matches
 * nothing, so its opening highlight lands on the wrong message.
 *
 * The attribute is the only handle before the first row renders, and a page with
 * no transcript has exactly one such box, so that remains the fallback.
 * @returns the scrollport that owns the message rows.
 */
export function scrollport(): HTMLElement | null {
  // Document order is ancestor-first and preview-first, so the first row or the
  // first attribute is not necessarily the live one: walk the rows until one is
  // LAID OUT (a row inside a hidden or collapsed conversation measures empty) and
  // take the scrollport that owns it. That is the transcript the reader is on.
  for (const row of document.querySelectorAll<HTMLElement>(MESSAGE_ROW_SELECTOR)) {
    if (row.getBoundingClientRect().height === 0) continue
    const enclosing = row.closest<HTMLElement>('[data-conversation-scroll]')
    if (enclosing !== null) return enclosing
  }
  // Before the first row renders the attribute is the only handle, and a page
  // with no transcript mounted has exactly one such box.
  return document.querySelector<HTMLElement>('[data-conversation-scroll]')
}

/** One human message row. Steering prompts are human turns too. */
export const MESSAGE_ROW_SELECTOR = '[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]'

/**
 * The identity a row is tracked and listed by, or null when the transcript gave
 * it none. Such a row cannot be listed or followed, so it is not a candidate for
 * "the message the reader is on" either.
 * @param row - one message row.
 * @returns the anchor key, the flow key, or null.
 */
export function rowKeyOf(row: HTMLElement): string | null {
  return row.dataset.chatAnchorKey ?? row.dataset.chatFlowKey ?? null
}



/**
 * Vertical breathing room a jump leaves above the row it lands on, matching
 * ChatView's own jump arithmetic (`scrollTop += row.top - scrollport.top - 24`).
 *
 * Shared rather than private to the overlay because it is also the width of the
 * band the viewport strip uses to decide which message the reader is on: a row
 * a jump just placed here is the row being read, even though its top edge sits
 * below the fold.
 */
export const LAND_OFFSET_PX = 24

/**
 * How far below the viewport's top edge a row may start and still count as the
 * one being read.
 *
 * A jump lands its target exactly {@link LAND_OFFSET_PX} below the fold — that is
 * the breathing room that offset exists to leave — so a strict "has crossed the
 * fold" test named the row ABOVE the one just jumped to, and the readout trailed
 * a message behind after every jump. The band is that offset plus a couple of
 * pixels of sub-pixel slack: a landed row measures 24.0000…, and a bare `<`
 * would drop it.
 *
 * Widening the fold also makes the answer flip to the next message a touch
 * earlier while scrolling, which is the direction it wants to err in anyway.
 */
export const FOLD_BAND_PX = LAND_OFFSET_PX + 2

/** One row as the fold test sees it: where it is, and whether it can be read. */
export interface FoldCandidate {
  readonly top: number
  readonly height: number
  readonly hidden: boolean
}

/**
 * Pick the message row the reader is on, from rows in transcript order.
 *
 * Pure over measurements so the rule can be pinned without a DOM. It is "sticky":
 * the LAST row that has reached the band, not the first still on screen — a
 * question can be screens tall, and a strictly-visible rule would blank the strip
 * for most of every answer.
 *
 * Two kinds of row are skipped rather than measured: the host's `hidden` ones, and
 * any that measures as an empty box. The second is what makes this safe against a
 * row hidden by CSS alone, which measures as `top: 0, height: 0` — above EVERY
 * fold by definition — so it always "reaches" the band, and if it is the last such
 * row it wins the scan outright: the strip then names a message that is not on
 * screen and never changes while the reader scrolls.
 * @param rows - measured rows, in transcript order.
 * @param fold - y coordinate of the band a row must reach.
 * @returns the index of the chosen row, or -1 when none can be read.
 */
export function pickRowUnderFold(rows: readonly FoldCandidate[], fold: number): number {
  let reached = -1
  let first = -1
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (row === undefined || row.hidden || row.height === 0) continue
    if (first === -1) first = index
    // Rows are in transcript order, so the first one starting at or below the
    // band ends the scan: nothing after it can be above it.
    if (row.top >= fold) break
    reached = index
  }
  // `reached` stays -1 only while every row still starts below the band — the
  // reader is above the first message, which is then the right answer.
  return reached === -1 ? first : reached
}

/**
 * The human message the reader is on, measured from a transcript's own rows.
 *
 * ONE rule for both surfaces that name a message: the viewport strip's readout
 * and the dialog's opening highlight. They used to answer this question twice —
 * a sticky band in one, an "at least 30px visible" test in the other — and the
 * two disagree exactly where it matters: a message long enough to scroll its top
 * past the edge but leave less than that threshold on screen. The strip kept
 * naming it (the reader is still inside it) while the dialog skipped to the next
 * message, so the two pointed at different rows for the same scroll position.
 *
 * Rows the transcript does not key, hides, or lays out at zero height are not
 * candidates: they cannot be listed or followed, and an unmeasurable row sits
 * above every band by definition.
 * @param scroller - the transcript's scrollport.
 * @returns the row and its key, or null when no message can be read.
 */
export function readingRow(scroller: HTMLElement): { readonly row: HTMLElement; readonly key: string } | null {
  const view = scroller.getBoundingClientRect()
  const rows: HTMLElement[] = []
  const candidates: FoldCandidate[] = []
  for (const row of scroller.querySelectorAll<HTMLElement>(MESSAGE_ROW_SELECTOR)) {
    if (rowKeyOf(row) === null) continue
    const box = row.getBoundingClientRect()
    rows.push(row)
    // `hidden` is `boolean | 'until-found'` on the IDL, so "not visible" is
    // anything but an explicit false.
    candidates.push({ top: box.top, height: box.height, hidden: row.hidden !== false })
  }
  const index = pickRowUnderFold(candidates, view.top + FOLD_BAND_PX)
  const row = index === -1 ? undefined : rows[index]
  if (row === undefined) return null
  const key = rowKeyOf(row)
  return key === null ? null : { row, key }
}

/**
 * A turn's usage and duration VALUES, as the host's tail pills render them (for
 * example `1.06k tok` and `21s`); both null when the turn carries neither.
 *
 * The value only — never the host's label in front of it. See
 * {@link valueOfLabel} for why the label is dropped.
 */
export interface TurnStats {
  readonly usage: string | null
  readonly duration: string | null
}

/** The empty reading, shared so callers can compare by identity. */
export const NO_TURN_STATS: TurnStats = { usage: null, duration: null }

/**
 * Identify a clock label leaf.
 *
 * ui-chat's `formatMessageClock` (in
 * `packages/client/ui-chat/src/client/chat/message-chrome.ts`) returns a bare
 * `HH:mm` for today, or `` `${md} ${HH:mm}` `` otherwise, where `md` comes from
 * the active locale's `clock.md` / `clock.ymd` TEMPLATE. Those templates are the
 * authority, so this mirrors them rather than guessing how a language writes a
 * date:
 *
 * | Locale | `clock.md` | `clock.ymd` |
 * |---|---|---|
 * | `zh` | `{m}月{d}日` | `{y}年{m}月{d}日` |
 * | `en` | `{m}/{d}` | `{y}-{m}-{d}` |
 *
 * Every other locale falls back to `en`, so those five shapes are everything the
 * host can print. An earlier version of this pattern was written against an
 * English form (`Mon D`) the host does not produce: it did not match `9/10
 * 20:16`, so the clock leaf was never stripped and the timestamp stayed glued to
 * the end of the message text — in both surfaces, since both read through here.
 *
 * The clock is REQUIRED on the date branches, which keeps a message that reads
 * like a bare date (`1/2`) from being mistaken for one. Strict full-string
 * match: a time-shaped fragment inside a sentence is intentionally not a
 * timestamp.
 */
const TIMESTAMP_PATTERN = /^(?:\d{1,2}:\d{2}|\d{1,2}月\d{1,2}日\s+\d{1,2}:\d{2}|\d{4}年\d{1,2}月\d{1,2}日\s+\d{1,2}:\d{2}|\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}|\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2})$/u

function looksLikeTimestamp(text: string): boolean {
  const t = text.trim()
  if (t === '') return false
  return TIMESTAMP_PATTERN.test(t)
}

/**
 * Split a chat row into the message text and an optional clock label.
 *
 * The IconActions time is a leaf sibling of the message bubble inside the row;
 * we identify it by content rather than by a stable selector because the
 * third-party plugin cannot import the host's hashed CSS module classes. The
 * clone-and-prune approach keeps the source row untouched so React's own
 * rendering of the transcript is unaffected.
 *
 * Cloning is the expensive part, so callers on a hot path (the HUD's scroll
 * reader) resolve the ONE row they need before calling this.
 *
 * The text comes back NFC-normalized. That is what keeps search honest: an IME
 * can put `が` in the DOM as one code point or as `か` plus a combining mark, so
 * without folding at the source a reader could see a match and fail to find it —
 * and, worse, the offsets search computes would index a string other than the
 * one on screen. NFC and NFD draw identically, so nothing changes visually.
 */
export function splitEntry(row: HTMLElement): { text: string; timestamp: string | null } {
  const clone = row.cloneNode(true) as HTMLElement
  let timestamp: string | null = null
  const targets = [clone, ...clone.querySelectorAll<HTMLElement>('*')]
  for (const el of targets) {
    if (el.children.length > 0) continue
    const t = (el.textContent ?? '').trim()
    if (t === '' || !looksLikeTimestamp(t)) continue
    if (timestamp === null) timestamp = t
    el.remove()
  }
  const text = (clone.textContent ?? '').replace(/\s+/gu, ' ').trim().normalize('NFC')
  return { text, timestamp }
}

/**
 * The value half of a host pill label: everything from its first digit on.
 *
 * The host renders `<label> <value>` — `Usage 1.06k tok`, `Ran for 21s` — and
 * the plugin keeps only the value, because the label cannot be trusted: the
 * shell ships `zh` and `en` alone (see `locales.ts`), so under a language-pack
 * locale the host falls back to English and `Usage 1.06k tok` lands in a
 * Japanese UI. Re-labelling with this plugin's own `turnUsage` / `turnDuration`
 * fixes that, while the number and its formatting still come from the host —
 * which is the part this plugin cannot derive: per-turn usage and wall time reach
 * a plugin only through a `conversation.chat.node` seat, and only for the single
 * turn that seat renders (see `session-totals.ts`).
 *
 * Slicing at the first digit is safe for the same reason the caller filters on
 * one: both host labels are a noun phrase followed by a number, and neither
 * noun phrase contains a digit.
 * @param label - the pill's trimmed text, known to contain a digit.
 * @returns the label's tail from that digit on.
 */
function valueOfLabel(label: string): string {
  const at = label.search(/\d/u)
  return at === -1 ? label : label.slice(at)
}

/**
 * Read one turn tail's usage and duration values.
 *
 * The host owns both the numbers and their formatting: a turn's tail already
 * carries a usage pill (`用量 1.06k tok` / `Usage 1.06k tok`) and a duration
 * pill (`用时 21s` / `Ran for 21s`), so this plugin reuses those numbers instead
 * of deriving tokens or wall time itself — but NOT their labels, which is what
 * {@link valueOfLabel} is about. The pills are plain buttons with hashed class
 * names, so they are located by contract position: the tail's LAST two
 * `aria-haspopup="dialog"` buttons are exactly the usage panel and the time
 * panel, in that order (TurnTailNodeView seats them after the branch action).
 * Their icons tell them apart — the usage pill draws an ellipse, the time pill
 * a circle. A pill hidden by the tail's hover-reveal keeps its text; opacity
 * does not remove it from the DOM.
 * @param tail - one `[data-turn-tail]` element.
 * @returns the values the tail carries, either of which may be null.
 */
export function turnStatsOfTail(tail: HTMLElement): TurnStats {
  const pills = [...tail.querySelectorAll<HTMLElement>('button[aria-haspopup="dialog"]')].slice(-2)
  let usage: string | null = null
  let duration: string | null = null
  for (const pill of pills) {
    const label = (pill.textContent ?? '').trim()
    // Both host labels always carry a number (a token count, a duration);
    // an icon-only button from the assistant-actions slot carries none.
    if (label === '' || !/\d/u.test(label)) continue
    const value = valueOfLabel(label)
    if (pill.querySelector('svg ellipse') !== null) usage = value
    else if (pill.querySelector('svg circle') !== null) duration = value
  }
  return usage === null && duration === null ? NO_TURN_STATS : { usage, duration }
}

/**
 * Read every rendered turn's stats, keyed by the turn's own id.
 * @param scroller - the transcript scrollport.
 * @returns the stats of every turn tail that carries at least one value.
 */
export function collectTurnStats(scroller: HTMLElement): Map<string, TurnStats> {
  const stats = new Map<string, TurnStats>()
  for (const tail of scroller.querySelectorAll<HTMLElement>('[data-turn-tail]')) {
    const turn = tail.dataset.turnTail
    if (turn === undefined) continue
    const read = turnStatsOfTail(tail)
    if (read !== NO_TURN_STATS) stats.set(turn, read)
  }
  return stats
}

/**
 * Read one specific turn's stats without scanning the other tails.
 *
 * The HUD runs on every scroll frame and only ever needs the row it landed on,
 * so it resolves that turn's tail directly instead of building the whole map.
 * @param scroller - the transcript scrollport.
 * @param turn - the `data-chat-turn` value of the row in question.
 * @returns the turn's stats, or all-null when the turn renders no tail yet.
 */
export function turnStatsOfTurn(scroller: HTMLElement, turn: string | undefined): TurnStats {
  if (turn === undefined) return NO_TURN_STATS
  const tail = scroller.querySelector<HTMLElement>(`[data-turn-tail="${CSS.escape(turn)}"]`)
  return tail === null ? NO_TURN_STATS : turnStatsOfTail(tail)
}
