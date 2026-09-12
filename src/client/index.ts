/**
 * Browser half of the session-messages plugin.
 *
 * Mounts the overlay into the `shell.overlay` slot — a frame-wide, click-through
 * floating layer declared by ui-layout — and contributes a settings card to
 * the Settings → Plugins → Plugin configuration page. The overlay never sees a
 * Cordis context: paging goes through the registration's inject face, and the
 * chord and `maxRows` are read from the `session-messages` settings scope.
 *
 * This file is `.ts`, not `.tsx`, on purpose: the rolldown/oxc JSX parser
 * trips over `SettingsScope<MessagesConfig>` whenever a generic-typed symbol
 * sits near a JSX element in cjs output. `React.createElement` keeps the
 * shape legible without paying that price.
 */
import { createElement, type ReactNode } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only merges: pull in ctx.slots, ctx.sessions, ctx.settingsScope.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Declares the 'shell.overlay' slot the overlay registers into; without this
// merge the slot name is not in SlotMap and the register below fails to compile.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Same, for the Session header's action seat the viewport strip registers into.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
// The catalog shape the model names are read from; `remote.session.modelCatalog`
// returns it, and its `groups[].models[].name` is the label the composer shows.
import type { ModelCatalog } from '@deepseek-ai/dsh-api-session-controller/types'
import { MessagesOverlaySlot, type MessagesOverlaySlotProps } from './overlay.tsx'
import { ViewportMessageHud, type ViewportMessageHudProps } from './hud.tsx'
import { MessagesSettingsCard } from './settings-card.tsx'
import { readSessionTotals, type SessionTotals } from './session-totals.ts'
import { publishModelNames } from './model-names.ts'
import { turnFactsReader, type TurnFacts } from './turn-facts.ts'
import { publishScope } from './settings-scope-holder.ts'
import type { MessagesConfig } from '../shared.ts'
import { en, NS, PACK_LOCALES, zh, type MessagesKey } from './locales.ts'

/** Settings namespace shared with the Node half (see `SETTINGS_NAMESPACE` in src/index.ts). */
const SETTINGS_NAMESPACE = 'session-messages'

/**
 * Services required before the overlay can register.
 *
 * `settingsScope` is deliberately NOT here. A module-level entry keeps the
 * whole plugin unmounted on any host without that service — the overlay would
 * disappear to gain a card. The card is registered through a nested inject
 * instead, so on such a host it simply never appears and everything else
 * keeps working.
 */
export const inject = ['slots', 'sessions', 'locale']

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    sessionMessages: MessagesKey
  }
}

/** Bound settings scope for `session-messages`. */
type MessagesScope = SettingsScope<MessagesConfig>

/**
 * The host surface the nested `settingsScope` inject hands back. Declared
 * structurally: the host supplies the real Context, and naming only what is
 * touched keeps this external package free of monorepo-internal types.
 */
interface SettingsScopeHost {
  settingsScope: { bind<T>(spec: { namespace: string }): MessagesScope }
  slots: {
    inject(name: string, register: () => unknown): void
    register(options: Record<string, unknown>, render: (props: never) => unknown): unknown
  }
  locale: { bind(namespace: string): (key: MessagesKey, params?: Record<string, unknown>) => string }
}

/** Render the settings card given the slot's standard props. */
function renderSettingsEntry(
  props: { t: (key: MessagesKey, params?: Record<string, unknown>) => string },
  scope: MessagesScope,
): ReactNode {
  // `scope`, not `settingsScope`: that is the prop name the card declares. A
  // mismatch here leaves `props.scope` undefined and the card throws inside the
  // slot's error boundary on its first `scope.getSnapshot()` — it never renders.
  return createElement(MessagesSettingsCard, { scope, t: props.t })
}

/**
 * Install the overlay and the settings card.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // The two locales the shell ships register together in the typed
  // `Record<BuiltInLocaleId, …>` form; the language-pack locales register one
  // namespace each, through the single-locale overload the docs reserve for
  // exactly this. Definitions stay the pack's business — see `locales.ts` for
  // why this plugin never calls `addLanguage`.
  ctx.effect(() => {
    const disposers = [
      ctx.locale.register(NS, { zh, en }),
      ...Object.entries(PACK_LOCALES)
        .map(([locale, dict]) => ctx.locale.register(NS, locale, dict)),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'session-messages: dictionaries')

  ctx.inject(['slots', 'sessions', 'locale'], (scope: ClientContext) => {
    // Bound once, resolved per read: `bind` reads the ACTIVE locale at call
    // time, which is what lets the registration-time strings below follow a
    // locale switch without re-registering.
    const t = scope.locale.bind(NS)

    // Model display names for the strip, injected separately because `remote` is
    // an EXTRA dependency: a composition without the remote layer must still get
    // both surfaces, and it does — the strip simply keeps printing model ids.
    //
    // Loaded once per registration rather than subscribed. The catalog is
    // deployment-wide and takes no session, which is exactly what makes it
    // readable here at all (see `model-names.ts` for why the selection service is
    // not), so one fetch answers every session; the strip re-renders when it
    // lands because the lookup is an external store.
    scope.inject(['remote', 'remote.session'], (remoteScope: ClientContext) => {
      const names = new Map<string, string>()
      remoteScope.effect(() => publishModelNames(
        (provider, model) => names.get(`${provider}/${model}`) ?? null,
      ))
      remoteScope.effect(() => {
        let live = true
        void remoteScope.remote.session.modelCatalog().then((response) => {
          if (!live || !response.ok) return
          for (const group of (response.value as ModelCatalog).groups) {
            for (const model of group.models) names.set(`${group.id}/${model.id}`, model.name)
          }
        }).catch(() => undefined)
        return () => { live = false }
      }, 'session-messages: model names')
    })

    // The overlay needs only `sessions`; it reads its own configuration from
    // the settings scope through the holder, falling back to the index-page
    // global until that scope is bound.
    scope.slots.inject('shell.overlay', () => scope.slots.register({
      name: 'shell.overlay',
      id: 'session-messages',
      order: 100,
      // A thunk, not a string: `SlotLabel` re-evaluates it on every read, so
      // the name the slot ledger shows for this entry is localized like the
      // surface it opens.
      label: () => t('settingsTitle'),
      locale: NS,
      inject: () => ({
        // Page one earlier messages window in through the current session's
        // own face; the overlay rebuilds its list from the new DOM.
        loadOlder: async (): Promise<void> => {
          const current = scope.sessions.list.getSnapshot().current
          if (current === undefined) return
          await scope.sessions.binding(current)?.session.loadOlder()
        },
        // Whether older messages remains. Without this the auto-fill loop could
        // never tell "exhausted" from "server is slow" and would spin.
        hasMore: (): boolean => {
          const current = scope.sessions.list.getSnapshot().current
          if (current === undefined) return false
          return scope.sessions.binding(current)?.session.getSnapshot().hasMore === true
        },
        // The session's own totals, read from its projection faces. A
        // composition without either projection unit returns null, and the
        // overlay simply renders no header stats instead of zeros.
        sessionTotals: (): SessionTotals | null => {
          const current = scope.sessions.list.getSnapshot().current
          if (current === undefined) return null
          const session = scope.sessions.binding(current)?.session
          return session === undefined ? null : readSessionTotals(session.projections)
        },
      }),
    }, (props: MessagesOverlaySlotProps) => createElement(MessagesOverlaySlot, props)))

    // The viewport strip: one item in the Session header's action row, not a
    // layer of its own. It rides the header's placement, stacking and its
    // blank-session hiding for free.
    //
    // `slots.inject` waits for the seat, so a composition without ui-conversation
    // simply never registers this and nothing else is affected. It declares a
    // locale because it prints one label of its own (`缓存命中`); everything else
    // it shows is already localized by the host.
    scope.slots.inject('conversation.session.header.actions', () =>
      scope.slots.register({
        name: 'conversation.session.header.actions',
        id: 'session-messages-strip',
        // After the preset label and the job list: this reads as session
        // metadata rather than as a control beside them.
        order: 30,
        locale: NS,
        // What the strip cannot read for itself: the facts of the turn it is
        // annotating. Both live in the session's event window rather than in a
        // projection (see `turn-facts.ts`), and they come back from one memoised
        // fold — the strip asks once per animation frame.
        inject: () => ({
          turnFactsOf: (turn: number | undefined): TurnFacts | null => {
            const current = scope.sessions.list.getSnapshot().current
            if (current === undefined) return null
            const source = scope.sessions.binding(current)?.eventSource
            return source === undefined ? null : turnFactsReader(source)(turn)
          },
        }),
      }, (props: ViewportMessageHudProps) => createElement(ViewportMessageHud, props)))
  })

  // The settings card, behind a nested inject: on a host with no
  // `settingsScope` service the callback never runs and no card appears,
  // instead of the whole plugin failing to mount.
  const settingsCtx = ctx as unknown as {
    inject(services: string[], callback: (scoped: SettingsScopeHost) => void): void
  }
  settingsCtx.inject(['settingsScope'], (scoped) => {
    const bound = scoped.settingsScope.bind<MessagesConfig>({ namespace: SETTINGS_NAMESPACE })
    // Published for the overlay, which mounted earlier and is already
    // subscribed to the holder.
    publishScope(bound)
    scoped.slots.inject('settings.plugin.item', () => scoped.slots.register({
      name: 'settings.plugin.item',
      // The card's key is the settings namespace: that is the only thing the
      // tab uses to pair a Host-served namespace with the card that edits it.
      key: SETTINGS_NAMESPACE,
      locale: NS,
      inject: () => ({
        t: scoped.locale.bind(NS),
      }),
    }, (props: { t: (key: MessagesKey, params?: Record<string, unknown>) => string }) =>
      renderSettingsEntry(props, bound)))
  })
}
