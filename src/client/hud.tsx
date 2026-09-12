/**
 * The viewport strip: the message the reader is currently on, rendered as one
 * more item inside the Session header's action row rather than as a layer of
 * its own.
 *
 * It registers into `conversation.session.header.actions` — the seat the host
 * declares for "title-adjacent Session actions", the same one the agent-preset
 * label and the job list use — so it lives inside the header and inherits its
 * show/hide for free (the header hides itself for a blank session, and being a
 * descendant, the strip goes with it).
 *
 * It is NOT laid out as one more chip beside the title, though: it takes itself
 * out of flow and centres on the header box, because the seat's own
 * `headerActions` is `flex: none` while the row's free space belongs to
 * `titleCluster` (`flex: 1`) — an in-flow item here can never reach the middle.
 * See {@link STRIP_STYLE} and {@link placeStrip} for how that centring is
 * anchored to the host's layout instead of to hardcoded insets.
 *
 * It reads through the same transcript contract as the overlay list (see
 * `transcript.ts`), but through a much cheaper path: the list clones every row
 * once per collection pass, while the strip resolves the single row under the
 * fold and caches its split by row identity — so scrolling inside one turn
 * clones nothing and only re-reads that turn's pills.
 *
 * It is opted into through the `showHud` setting and renders nothing otherwise.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only merge: pulls in the session standard props (`useProjection`) the
// component below destructures off `PropsRuntime`.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { readingRow, scrollport, splitEntry, turnStatsOfTurn } from './transcript.ts'
import { NS } from './locales.ts'
import type { TurnFacts } from './turn-facts.ts'
import { useModelNameLookup } from './model-names.ts'
import { useMessagesConfig } from './use-messages-config.ts'

/**
 * Props the header seat hands the component.
 *
 * `PropsRuntime` carries the seat's own shares plus the SESSION standard props —
 * `sessionId`, `useSession` and `useProjection`. The strip needs none of them:
 * every figure it prints beside the message belongs to that message's turn, and
 * those arrive through the injected lookup, so there is no projection read here
 * that could come back empty before the session binding existed.
 */
export type ViewportMessageHudProps =
  PropsRuntime<'conversation.session.header.actions'> & PropsLocale<typeof NS> & ViewportMessageHudInjected

/**
 * The face this plugin injects into its own strip registration.
 *
 * Declared rather than inferred from the injected object, the way the overlay's
 * props are: the two are checked against each other where the strip is
 * registered, which is where a drift would surface.
 */
export interface ViewportMessageHudInjected {
  /**
   * The facts of the given turn — the model it ran and its own cache share —
   * folded from the session's loaded event window. Null when that window does not
   * reach the turn, which the strip reports rather than filling in with a
   * session-wide figure about a different moment.
   */
  readonly turnFactsOf: (turn: number | undefined) => TurnFacts | null
}

/** What the strip renders from the transcript. */
interface ViewportReading {
  /** Message text, timestamp leaf stripped. */
  readonly text: string
  /** Clock label of the row, null when the host renders none. */
  readonly timestamp: string | null
  /** Usage pill label of the row's turn, null when the turn carries none. */
  readonly usage: string | null
  /** Duration pill label of the row's turn, null when the turn carries none. */
  readonly duration: string | null
  /** The row's turn, for the per-turn model lookup; undefined when unreadable. */
  readonly turn: number | undefined
}

/** The row the reader is on, with the stats that do not need a clone. */
interface ViewportHit {
  readonly row: HTMLElement
  /** Identity of the row, so its split can be cached across frames. */
  readonly key: string
  readonly usage: string | null
  readonly duration: string | null
  /** The row's turn, for the per-turn model lookup; undefined when unreadable. */
  readonly turn: number | undefined
}

/**
 * Hard cap on the preview, so a pathological message cannot build a huge text
 * node. Generous on purpose: the visual limit is {@link MAX_HUD_LINES} lines,
 * which the line-clamp enforces, and slicing shorter than the clamp can show
 * would truncate a narrow-script message that would have fitted.
 */
const MAX_HUD_CHARS = 500

/**
 * Lines the preview may occupy before it clamps. Three is enough for a long
 * prompt to be recognisable without the strip growing into the transcript it is
 * annotating — the overlay list is still there for the full text.
 */
const MAX_HUD_LINES = 3

/**
 * How often the strip re-reads itself with no scrolling and no resizing.
 *
 * A turn settles its duration and usage when it ends, which is a DOM mutation
 * rather than a scroll, so the scroll listener alone would leave the strip
 * showing the live numbers forever. A second is well under the rate at which
 * those labels can visibly change, and the read itself is a handful of
 * measurements plus one cached split.
 */
const HUD_REFRESH_MS = 1_000

/**
 * Resolve the row under the fold and the stats that need no cloning.
 *
 * The row comes from {@link readingRow}, the same rule the dialog uses for its
 * opening highlight — one answer to "which message is the reader on", so the two
 * surfaces cannot point at different messages for one scroll position.
 * @returns the hit, or null when no conversation or no human message is present.
 */
function hitOfViewport(): ViewportHit | null {
  const scroller = scrollport()
  if (scroller === null) return null
  const reading = readingRow(scroller)
  if (reading === null) return null
  const stats = turnStatsOfTurn(scroller, reading.row.dataset.chatTurn)
  const turn = Number(reading.row.dataset.chatTurn)
  return {
    row: reading.row,
    key: reading.key,
    usage: stats.usage,
    duration: stats.duration,
    turn: Number.isInteger(turn) ? turn : undefined,
  }
}

/** True when two consecutive readings would render identically. */
function sameReading(a: ViewportReading | null, b: ViewportReading | null): boolean {
  if (a === null || b === null) return a === b
  return a.text === b.text && a.timestamp === b.timestamp
    && a.usage === b.usage && a.duration === b.duration && a.turn === b.turn
}

/**
 * Centre the strip on the header, in both axes.
 *
 * Horizontal placement is pure CSS: `left: 50%` resolves against the containing
 * block, which is the conversation column (ui-conversation's `.root` declares
 * `position: relative` "for slot-owned absolute chrome"), and the header spans
 * that whole column.
 *
 * Vertical placement has to be measured, because the strip is out of flow and
 * nothing in CSS knows where the header's box is. The anchor is the header
 * element itself, which is what "centred on the overlay" means: the header is
 * taller than its first row — it also carries the view tabs — so anchoring on
 * the row (an earlier attempt) left the strip visibly high.
 *
 * Two earlier attempts are worth not repeating:
 * - The *static position* of an absolutely-positioned flex child. The spec says
 *   it is laid out as if it were the sole flex item, so it should have honoured
 *   the row's `align-items: center`; in practice the strip came out at the
 *   containing block's top edge.
 * - Anchoring on the seat's own boxes. Which of them collapses is a function of
 *   the composition (`.headerActions` is zero-height when the strip is its only
 *   child, the corner is `display: none` when empty), so it needed a fallback
 *   chain for no benefit — the header is one element that is always there.
 *
 * `top` is written for the element's TOP EDGE and the transform stays
 * horizontal-only, so if this never runs the strip falls back to its static
 * position and stays visible instead of being pulled off the top of the window.
 *
 * Written straight onto the node rather than through React state: it is a
 * function of layout, and routing it through a re-render would put a state
 * update inside the very frame loop that measures it.
 * @param node - the strip element.
 */
function placeStrip(node: HTMLElement): void {
  // For an absolutely-positioned element the offsetParent IS its containing
  // block — the coordinate space `top` below is expressed in.
  const frame = node.offsetParent
  const header = node.closest('header')
  if (!(frame instanceof HTMLElement) || header === null) return
  const box = header.getBoundingClientRect()
  // Zero when the header hides itself for a blank Session; there is nothing to
  // centre against, and the strip is not rendered then either.
  if (box.height === 0) return
  const centre = box.top + box.height / 2
  node.style.top = `${centre - node.offsetHeight / 2 - frame.getBoundingClientRect().top}px`
}

/**
 * Slot entry for `conversation.session.header.actions`.
 * @param props - the injected session facts and the locale seat.
 * @returns the strip, or null while disabled or with no message to name.
 */
export function ViewportMessageHud({ turnFactsOf, t }: ViewportMessageHudProps): ReactNode {
  const config = useMessagesConfig()
  const enabled = config.showHud
  /**
   * The name the composer's picker would show, so the strip and the composer
   * cannot read as two different choices; the bare id until a catalog lands.
   */
  const nameOf = useModelNameLookup()
  const [reading, setReading] = useState<ViewportReading | null>(null)
  /**
   * The split of the last row read, kept across frames. Splitting clones the
   * row, so it must not run on every animation frame — only when the row under
   * the fold actually changes. User messages do not stream, so a cached split
   * stays valid for the row's whole life.
   */
  const splitRef = useRef<{ key: string; text: string; timestamp: string | null } | null>(null)
  /** The rendered strip, so the frame loop can reposition it without a re-render. */
  const stripRef = useRef<HTMLSpanElement | null>(null)

  // No dependency array: the strip only exists once there is a reading, and
  // running after every render is what puts it on the row for the FIRST paint
  // instead of letting it flash at the containing block's origin.
  useLayoutEffect(() => {
    const node = stripRef.current
    if (node !== null) placeStrip(node)
  })

  useEffect(() => {
    if (!enabled) {
      splitRef.current = null
      setReading(null)
      return undefined
    }

    let frame = 0
    const measure = (): void => {
      frame = 0
      const hit = hitOfViewport()
      if (hit === null) {
        splitRef.current = null
        setReading(null)
        return
      }
      const cached = splitRef.current
      let split: { text: string; timestamp: string | null }
      // Only a row with an identity may use the cache: a row the transcript did
      // not key would collide with every other such row on `''`, and the strip
      // would keep printing the first one's text while the reader scrolls past
      // all of them.
      if (cached !== null && hit.key !== '' && cached.key === hit.key) {
        split = cached
      } else {
        split = splitEntry(hit.row)
        splitRef.current = { key: hit.key, ...split }
      }
      const next: ViewportReading = {
        text: split.text === '' ? '—' : split.text,
        timestamp: split.timestamp,
        usage: hit.usage,
        duration: hit.duration,
        turn: hit.turn,
      }
      // A new object every frame would re-render the strip on every animation
      // frame of a scroll; handing React the same reference bails out instead.
      setReading(current => (sameReading(current, next) ? current : next))
      // Reposition even when the reading bailed out: the row can move under the
      // strip (a resize, the sidebar toggling, the tabs row appearing) without
      // a single character of the message changing.
      const node = stripRef.current
      if (node !== null) placeStrip(node)
    }
    const schedule = (): void => {
      if (frame !== 0) return
      frame = requestAnimationFrame(measure)
    }

    measure()
    // Scroll events do not bubble, but a capture-phase listener on the document
    // still sees every descendant's. That avoids having to locate the
    // scrollport up front and keep watching for it to appear.
    document.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    const timer = window.setInterval(schedule, HUD_REFRESH_MS)
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      document.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      window.clearInterval(timer)
    }
  }, [enabled])

  if (!enabled || reading === null) return null

  // Two capsules, one per axis of the sentence: "when and with what" on the
  // left, "what it cost" on the right. The parts share a capsule because each
  // already names itself — which is why nothing here may be the host's own copy:
  // the two numbers come from the turn tail, but their labels are this plugin's
  // `turnUsage` / `turnDuration`, since the host's own pill label stays English
  // under any language-pack locale.
  // Both figures belong to THIS turn. Never the session's current selection nor
  // its session-wide cache share: those are facts about a different moment, and
  // printing them beside an older message states them with the same confidence as
  // the truth.
  const facts = turnFactsOf(reading.turn)
  const route = facts === null ? null : facts.route
  const model = route === null
    ? t('modelUnknown')
    : nameOf(route.provider, route.model) ?? route.model
  const context = [reading.timestamp, model].filter(value => value !== null).join(' · ')
  const cacheHitText = facts === null ? null : facts.cacheHit
  const cacheHit = cacheHitText === null ? null : t('sessionCacheHit', { percent: cacheHitText })
  const costs = [
    reading.usage === null ? null : t('turnUsage', { value: reading.usage }),
    reading.duration === null ? null : t('turnDuration', { value: reading.duration }),
    cacheHit,
  ].filter(value => value !== null).join(' · ')
  return (
    // aria-hidden: the strip repeats content the transcript already renders, so
    // announcing it again would only make a screen reader say everything twice.
    <span ref={stripRef} style={STRIP_STYLE} aria-hidden="true">
      {context !== '' && <Tag>{context}</Tag>}
      <span style={TEXT_STYLE}>{reading.text.slice(0, MAX_HUD_CHARS)}</span>
      {costs !== '' && <Tag>{costs}</Tag>}
    </span>
  )
}

/**
 * Centred on the Session header, in the header's own chip idiom.
 *
 * Placement: `left: 50%` resolves against the containing block, which is the
 * conversation column (ui-conversation's `.root` declares `position: relative`
 * "for slot-owned absolute chrome"). The header spans that column, so 50% of it
 * is the header's own centre — not the viewport's, which would sit off-centre
 * whenever the sidebar changes width. `top` is written by {@link placeStrip},
 * which measures the header and writes the element's top edge; the transform is
 * horizontal-only so that a failure to measure degrades to "slightly misaligned
 * but visible" instead of "off the top of the screen".
 *
 * Being out of flow is what makes centering possible at all: the seat's own
 * `headerActions` is `flex: none` and the row's free space belongs to
 * `titleCluster` (`flex: 1`), so an in-flow item here can never reach the
 * middle.
 *
 * Look: taken from the seat's existing chip (`AgentPresetLabel.module.css`) —
 * its 6px radius, translucent `fill` and secondary label colour. A pill with a
 * hard border and `bg-layer-*` (the first attempt) reads as a card dropped onto
 * the header, because none of the header's own chrome is built that way.
 *
 * It departs from the chip in one respect: the message is set at body size and
 * allowed to wrap, because this is something to READ, not a label to scan. The
 * box therefore has a `minHeight` rather than the chip's fixed 22px, and grows
 * with the clamped preview. {@link placeStrip} measures the grown height, so the
 * centring follows.
 */
const STRIP_STYLE: CSSProperties = {
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  // The two capsules centre on the message block rather than hanging off its
  // first line: beside a two-line preview, first-line alignment reads as the
  // capsules having drifted upwards.
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minWidth: 0,
  // Bounded so a long message cannot reach the title on the left or the
  // utilities on the right. The vw term keeps that true on a narrow window.
  //
  // Wide, because the capsules are not compressible: the model id and the two
  // host labels have to fit whole before the message gets a single column, and
  // a narrow cap would starve the very thing the strip exists to show.
  maxWidth: 'min(760px, 58vw)',
  minHeight: 22,
  padding: '3px 10px',
  borderRadius: 6,
  background: 'var(--dsw-alias-fill-tsp-secondary)',
  color: 'var(--dsw-alias-label-secondary)',
  fontSize: 12,
  lineHeight: '18px',
  // Every part centres: the clock, the wrapped message lines and the two
  // numbers. Inherited, so the preview does not have to restate it.
  textAlign: 'center',
  // Also inherited, into the tags: a running clock and live token counts must
  // not shuffle their width as the digits change.
  fontVariantNumeric: 'tabular-nums',
  // Out of flow and centered, it can overlap a long title's tail; clicks must
  // still reach whatever it covers.
  pointerEvents: 'none',
}

/**
 * The preview: body size, wrapped, clamped to {@link MAX_HUD_LINES} lines. It is
 * the only part allowed to shrink and the only one that keeps the strip's own
 * colour.
 *
 * `flex: 0 1 auto` — it may shrink, but it must NOT grow. Letting it grow made
 * the strip always as wide as `maxWidth`, which pushed the clock to the left
 * edge and the numbers to the right edge: three parts pinned to the ends of a
 * wide box read as anything but centred. Without the growth the strip hugs its
 * content, so the three sit together as one centred group.
 *
 * The `-webkit-box` triple is the same line-clamp the dialog's rows use
 * (`overlay.tsx`): `line-clamp` alone is still not honoured everywhere, and the
 * vendor-prefixed spelling needs the box display to take effect.
 */
const TEXT_STYLE: CSSProperties = {
  flex: '0 1 auto',
  minWidth: 0,
  fontSize: 14,
  lineHeight: '20px',
  display: '-webkit-box',
  WebkitLineClamp: MAX_HUD_LINES,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  wordBreak: 'break-word',
}

/**
 * The clock and the numbers are the host's `Tag` primitive (`tone="outline"`),
 * not spans styled to look like one: a hairline capsule on tertiary text reads
 * as meta at a glance, which is exactly what the message preview next to it is
 * not. Styling them as plain text — the previous version — left all three
 * looking like one run of copy, with no way to tell where the message started.
 *
 * `Tag` brings its own geometry (999px radius, `1px 8px`, 11px/17px, `nowrap`),
 * so nothing here restates it. At 20px tall with its hairline, one capsule on
 * each side of a single-line message lands level with it unaided; the strip's
 * `alignItems: center` is what keeps that true once the message wraps.
 */
