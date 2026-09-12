/**
 * What the strip knows about one turn, folded from the session's own event
 * window: which model the turn ran, and how much of its prompt came from cache.
 *
 * Every figure the strip prints beside a message has to belong to THAT message.
 * The session-wide `modelSelection.lastUsed` and the session-wide `tokenUsage`
 * cache share are both facts about the newest state of the session, so printing
 * them next to an older message states something false with the same confidence
 * as the truth. The honest source is the turn itself.
 *
 * Those facts reach a plugin without touching the DOM: a Session binding exposes
 * its loaded event window (`binding.eventSource`), the same contiguous history the
 * conversation is assembled from, and each turn's `assistant/message` events carry
 * both the model that served the request and the usage it billed.
 *
 * When that window does not reach a turn there is no answer to give, and callers
 * say so rather than substituting a session-wide figure.
 */
import { deriveTurnTokenUsage } from '@deepseek-ai/dsh-token-meter/client'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type { SessionEventLikeEntry, SessionEventSource } from '@deepseek-ai/dsh-api-session-controller/client'
import { turnCacheHitOf } from './session-totals.ts'

/** The route one request went out on: which provider served it, and which model. */
export interface ModelRoute {
  readonly provider: string
  readonly model: string
}

/** The strip's per-turn facts; either may be unknown. */
export interface TurnFacts {
  /** The last model to serve this turn, or null when its events are outside the window. */
  readonly route: ModelRoute | null
  /** The turn's cache-hit share as display text, or null when it cannot be known. */
  readonly cacheHit: string | null
}

/** The `turn/start` payload fields this module reads. */
interface TurnStartData {
  readonly turn?: unknown
}

/** The `assistant/message` payload fields this module reads. */
interface AssistantMessageData {
  readonly message?: { readonly source?: { readonly provider?: unknown; readonly model?: unknown } }
}

/**
 * The model a turn ran, from that turn's own events.
 *
 * The LAST assistant message wins, because a turn can carry several (tool steps,
 * a retry) and the model that produced the reply on screen is the one from the
 * final message — the same message the tail treats as the turn's closing one.
 * @param events - one turn's events, in order.
 * @returns the route, or null when none of them names a model.
 */
function routeOf(events: readonly SessionEvent[]): ModelRoute | null {
  let route: ModelRoute | null = null
  for (const event of events) {
    if (event.type !== 'assistant/message') continue
    const source = (event.data as AssistantMessageData).message?.source
    const model = source?.model
    if (typeof model !== 'string' || model === '') continue
    route = { provider: typeof source?.provider === 'string' ? source.provider : '', model }
  }
  return route
}

/**
 * Fold one loaded event window into per-turn facts.
 *
 * The usage half is NOT folded here. It comes from `deriveTurnTokenUsage`, the
 * host's own browser-safe fold (`@deepseek-ai/dsh-token-meter/client`), which is
 * the exact function ui-chat builds a turn's tail with — so a turn's cache share
 * follows the rules the host already settled: which events count, that a final
 * message's usage supersedes a streaming sample, that retries add, and that an
 * incomplete turn yields NOTHING rather than a partial sum. Re-deriving that here
 * would be a second implementation of a subtle rule set whose first divergence
 * would stay invisible until two surfaces were compared.
 *
 * Events are grouped by the turn they belong to before either fold runs, because
 * the usage fold is defined over one turn's whole window: it fails closed for a
 * slice missing the turn's own start or end, AND for one that carries anything
 * past `turn/end`. The slice therefore runs `turn/start` → `turn/end` inclusive
 * and no further — the next prompt is appended before the next `turn/start`, so a
 * slice that ran to that boundary would break every turn's figure.
 * @param entries - one `SessionEventWindow['entries']`.
 * @returns the facts per turn; turns with no evidence are absent.
 */
export function foldTurnFacts(entries: readonly SessionEventLikeEntry[]): ReadonlyMap<number, TurnFacts> {
  const byTurn = new Map<number, SessionEvent[]>()
  let turn: number | null = null
  for (const entry of entries) {
    // Client-only live chunks interleave with the durable events and carry no
    // part of a turn's evidence.
    if (entry.type !== 'event') continue
    const event = entry.event
    if (event.type === 'turn/start') {
      const started = (event.data as TurnStartData).turn
      if (typeof started === 'number') {
        turn = started
        // The turn's own start belongs IN its slice: the usage fold validates the
        // lifecycle and fails closed for a window that does not open with it, so
        // dropping this event would make every turn's usage silently unknown.
        if (!byTurn.has(started)) byTurn.set(started, [event])
      }
      continue
    }
    if (turn === null) continue
    byTurn.get(turn)?.push(event)
    // The turn's window CLOSES at its own end. The usage fold fails closed for
    // anything it sees after `turn/end`, and what follows belongs to the next turn
    // anyway — a prompt is appended BEFORE that turn's `turn/start`, so a slice
    // that ran until the next start would swallow it and invalidate the turn.
    if (event.type === 'turn/end') turn = null
  }

  const facts = new Map<number, TurnFacts>()
  for (const [key, events] of byTurn) {
    facts.set(key, {
      route: routeOf(events),
      cacheHit: turnCacheHitOf(deriveTurnTokenUsage(events)),
    })
  }
  return facts
}

/**
 * Build a per-turn lookup over one event source, re-folding only when the window
 * actually moved.
 *
 * The strip asks once per animation frame and the fold is O(events) plus a usage
 * aggregation, which is far too much to redo at that rate. `revision` is the
 * window's own change counter, so one integer comparison answers "has anything
 * moved" — and because `entries` is a lazily materialised getter on the snapshot,
 * an unchanged revision does not even pay for the list.
 * @param source - the binding's event source.
 * @returns a lookup for one turn's facts, or null when the window does not cover it.
 */
function createTurnFactsReader(source: SessionEventSource): (turn: number | undefined) => TurnFacts | null {
  let revision = -1
  let byTurn: ReadonlyMap<number, TurnFacts> = new Map()
  return (turn) => {
    if (turn === undefined) return null
    const window = source.getSnapshot()
    if (window.revision !== revision) {
      revision = window.revision
      byTurn = foldTurnFacts(window.entries)
    }
    return byTurn.get(turn) ?? null
  }
}

/**
 * One reader per event source.
 *
 * Keyed weakly by the source rather than held in a field, so a binding that goes
 * away takes its fold with it — the same reason the reader is built here instead
 * of by every caller that needs one.
 */
const readers = new WeakMap<SessionEventSource, (turn: number | undefined) => TurnFacts | null>()

/**
 * The per-turn facts lookup for one session binding.
 * @param source - the binding's event source.
 * @returns a lookup, reused across calls for the same source.
 */
export function turnFactsReader(source: SessionEventSource): (turn: number | undefined) => TurnFacts | null {
  const existing = readers.get(source)
  if (existing !== undefined) return existing
  const reader = createTurnFactsReader(source)
  readers.set(source, reader)
  return reader
}
