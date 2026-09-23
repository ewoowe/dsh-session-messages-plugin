/**
 * Browser half of the session-messages plugin.
 *
 * Mounts the overlay into the `shell.overlay` slot — a frame-wide, click-through
 * floating layer declared by ui-layout — and contributes the configuration form
 * to this bundle's own page on the Plugins surface (the `plugins.bundle.config`
 * seat, keyed by the package name). The overlay never sees a Cordis context:
 * paging goes through the registration's inject face, and the chord and
 * `maxRows` are read from the `session-messages` settings scope.
 *
 * This file is `.ts`, not `.tsx`, on purpose: the rolldown/oxc JSX parser
 * trips over `ConfigForm<MessagesConfig>` whenever a generic-typed symbol
 * sits near a JSX element in cjs output. `React.createElement` keeps the
 * shape legible without paying that price.
 */
import { createElement, type ReactNode } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only merges: pull in ctx.slots, ctx.sessions, ctx.configForms.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
// The session row a `mainView` lookup is read off. Named rather than inferred:
// `Object.values` widens to `unknown[]` on the branded `SessionId` key type.
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Declares the 'shell.overlay' slot the overlay registers into; without this
// merge the slot name is not in SlotMap and the register below fails to compile.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Same, for the Session header's action seat the viewport strip registers into.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
// Declares the 'plugins.bundle.config' seat the configuration form registers
// into; without this merge that slot name is not in SlotMap and the register
// below does not compile.
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// The catalog shape the model names are read from; `remote.session.modelCatalog`
// returns it, and its `groups[].models[].name` is the label the composer shows.
import type { ModelCatalog } from '@deepseek-ai/dsh-api-session-controller/types'
import { MessagesOverlaySlot, type MessagesOverlaySlotProps } from './overlay.tsx'
import { ViewportMessageHud, type ViewportMessageHudProps } from './hud.tsx'
import { MessagesSettingsCard } from './settings-card.tsx'
import { readSessionTotals, type SessionTotals } from './session-totals.ts'
import { publishModelNames } from './model-names.ts'
import { turnFactsReader, type TurnFacts } from './turn-facts.ts'
import { publishForm } from './settings-form-holder.ts'
import type { MessagesConfig } from '../shared.ts'
import { en, NS, PACK_LOCALES, zh, type MessagesKey } from './locales.ts'

/** Settings namespace shared with the Node half (see `SETTINGS_NAMESPACE` in src/index.ts). */
const SETTINGS_NAMESPACE = 'session-messages'

/**
 * The package name the profile installs this bundle under.
 *
 * It is the key a bundle's configuration is dispatched with: the Plugins page
 * pairs a registered `plugins.bundle.config` entry with the bundle page it
 * belongs to by the package name it read from the Host's inventory, so a
 * mismatch — or the seat this used to register into, `settings.plugin.item`,
 * which 0.1.6 removed — renders nothing, silently.
 */
const BUNDLE_PACKAGE_NAME = 'dsh-session-messages'

/**
 * The session the main view is showing, or undefined when none is open.
 *
 * 0.1.6 dropped `SessionListState.current`, which this plugin used to read. The
 * view now retains the session it displays under the `mainView` source, and the
 * host's own consumers pick it out of the list that way (DocumentTitle, the
 * workspace browser, ui-session). Reading the legacy field last keeps one build
 * working on a 0.1.5 host too, where `retainedBy` does not exist at all.
 * @param sessions - the session controller's read face.
 * @returns the main view's session id, or undefined when no session is open.
 */
function mainViewSessionId(sessions: ClientContext['sessions']): SessionId | undefined {
  const list = sessions.list.getSnapshot()
  const rows = Object.values(list.byId) as readonly SessionSummary[]
  // `mainView` is a retention source declared by ui-session and ui-workspace,
  // not by the controller whose types this file compiles against, so the count
  // is read structurally instead of through the merged label union. The
  // `undefined` in the cast is the 0.1.5 host, whose rows carry no counts at all.
  const row = rows.find((candidate) => {
    const retained = candidate.retainedBy as Partial<Record<string, number>> | undefined
    return (retained?.mainView ?? 0) > 0
  })
  if (row !== undefined) return row.id
  return (list as { readonly current?: SessionId }).current
}

/**
 * Services required before the overlay can register.
 *
 * `configForms` is deliberately NOT here. A module-level entry keeps the
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

/** Config form for `session-messages`. */
type MessagesForm = ConfigForm<MessagesConfig>

/**
 * The host surface the nested `configForms` inject hands back. Declared
 * structurally: the host supplies the real Context, and naming only what is
 * touched keeps this external package free of monorepo-internal types.
 */
interface SettingsFormHost {
  configForms: { get<T>(entryId: string): ConfigForm<T> }
  slots: {
    inject(name: string, register: () => unknown): void
    register(options: Record<string, unknown>, render: (props: never) => unknown): unknown
  }
  locale: { bind(namespace: string): (key: MessagesKey, params?: Record<string, unknown>) => string }
}

/** Render the settings card given the slot's standard props. */
function renderSettingsEntry(
  props: { view: 'summary' | 'page'; t: (key: MessagesKey, params?: Record<string, unknown>) => string },
  form: MessagesForm,
): ReactNode {
  // `form`, not `scope`: that is the prop name the card declares. A mismatch
  // here leaves `props.form` undefined and the card throws inside the slot's
  // error boundary on its first `form.getSnapshot()` — it never renders.
  return createElement(MessagesSettingsCard, { form, view: props.view, t: props.t })
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
          const current = mainViewSessionId(scope.sessions)
          if (current === undefined) return
          await scope.sessions.binding(current)?.session.loadOlder()
        },
        // Whether older messages remains. Without this the auto-fill loop could
        // never tell "exhausted" from "server is slow" and would spin.
        hasMore: (): boolean => {
          const current = mainViewSessionId(scope.sessions)
          if (current === undefined) return false
          return scope.sessions.binding(current)?.session.getSnapshot().hasMore === true
        },
        // The session's own totals, read from its projection faces. A
        // composition without either projection unit returns null, and the
        // overlay simply renders no header stats instead of zeros.
        sessionTotals: (): SessionTotals | null => {
          const current = mainViewSessionId(scope.sessions)
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
            const current = mainViewSessionId(scope.sessions)
            if (current === undefined) return null
            const source = scope.sessions.binding(current)?.eventSource
            return source === undefined ? null : turnFactsReader(source)(turn)
          },
        }),
      }, (props: ViewportMessageHudProps) => createElement(ViewportMessageHud, props)))
  })

  // The settings card, behind a nested inject: on a host with no `configForms`
  // service the callback never runs and no card appears, instead of the whole
  // plugin failing to mount.
  const settingsCtx = ctx as unknown as {
    inject(services: string[], callback: (scoped: SettingsFormHost) => void): void
  }
  settingsCtx.inject(['configForms'], (scoped) => {
    // Addressed by the profile ENTRY id — the settings namespace — not by the
    // bundle package name the seat below is keyed with: the two are different
    // identities and only this one reaches the document.
    const bound = scoped.configForms.get<MessagesConfig>(SETTINGS_NAMESPACE)
    // Published for the overlay, which mounted earlier and is already
    // subscribed to the holder.
    publishForm(bound)
    // The bundle's own page on the Plugins surface. The seat is keyed by the
    // PACKAGE name because the page pairs the form with whichever bundle that
    // name matches, and asks for `view: 'page'` only. `SETTINGS_NAMESPACE`
    // still names the document being edited.
    scoped.slots.inject('plugins.bundle.config', () => scoped.slots.register({
      name: 'plugins.bundle.config',
      key: BUNDLE_PACKAGE_NAME,
      locale: NS,
      inject: () => ({
        t: scoped.locale.bind(NS),
      }),
    }, (props: { view: 'summary' | 'page'; t: (key: MessagesKey, params?: Record<string, unknown>) => string }) =>
      renderSettingsEntry(props, bound)))
  })
}
