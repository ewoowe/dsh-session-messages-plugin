/**
 * Node half of the session-messages plugin.
 *
 * The Loader imports this file by `main`. It owns the configuration Schema and
 * the plugin identity the settings document is keyed by. As of dsh 0.1.7 a
 * plugin no longer registers a settings section imperatively: every field this
 * Schema marks `.volatile()` is projected into the settings document under the
 * profile entry id (`session-messages`, see `cordis.patch.yml`), which is what
 * puts the entry into `settings.describe` and lets the browser half reach it
 * through `ctx.configForms`. It also declares that this plugin draws its own
 * configuration card, so the settings service must not generate one, and
 * publishes the resolved configuration into the page as a global for the
 * browser half's bootstrap fallback.
 */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
// Type-only merge: pulls in the 'webserver/index-inject' event signature.
import type {} from '@deepseek-ai/dsh-host-webserver'
// Type-only merge: pulls in the 'settings' service registration (configure).
import type {} from '@deepseek-ai/dsh-settings'
import { CONFIG_GLOBAL, DEFAULT_CONFIG } from './shared.ts'

export const name = 'session-messages'

/**
 * Resolved configuration the Loader hands to {@link apply}.
 *
 * Each field is a `Volatile` reference rather than a plain value, because a
 * volatile schema field resolves to a live reference whose `get()` reads the
 * current value. That indirection is what lets a settings write reach the
 * running plugin without a reload.
 */
export interface Config {
  /** `KeyboardEvent.key` in lowercase that opens the overlay (for example `s`). */
  key: Volatile<string>
  /** Whether the Control modifier must be held. */
  ctrl: Volatile<boolean>
  /** Whether the Alt modifier must be held. */
  alt: Volatile<boolean>
  /** Whether the Shift modifier must be held. */
  shift: Volatile<boolean>
  /** Whether the Meta modifier (Cmd on macOS, Win on Windows) must be held. */
  meta: Volatile<boolean>
  /** Whether scrolling up moves the highlight down. */
  wheelInverted: Volatile<boolean>
  /** Maximum number of rows rendered in the overlay. */
  maxRows: Volatile<number>
  /** Whether the top-center viewport strip is shown. */
  showHud: Volatile<boolean>
}

/**
 * Validated session-messages configuration schema.
 *
 * Every field is marked `.volatile()`: `volatileForm` in `@deepseek-ai/dsh-settings`
 * projects ONLY volatile fields into a settings form, so marking them is what
 * makes this entry configurable at all. The defaults mirror
 * {@link DEFAULT_CONFIG} so a patch that names no field still resolves to the
 * same composition the browser half falls back to.
 *
 * The type is inferred rather than annotated `Schema<Config>`: a volatile
 * field's OUTPUT is a `Volatile` reference while its INPUT stays the plain
 * value, so the schema's input type is deliberately not `Config`. Annotating
 * it would assert the wrong input shape.
 */
export const Config = Schema.object({
  key: Schema.string().default(DEFAULT_CONFIG.key).volatile(),
  ctrl: Schema.boolean().default(DEFAULT_CONFIG.ctrl).volatile(),
  alt: Schema.boolean().default(DEFAULT_CONFIG.alt).volatile(),
  shift: Schema.boolean().default(DEFAULT_CONFIG.shift).volatile(),
  meta: Schema.boolean().default(DEFAULT_CONFIG.meta).volatile(),
  wheelInverted: Schema.boolean().default(DEFAULT_CONFIG.wheelInverted).volatile(),
  maxRows: Schema.number().default(DEFAULT_CONFIG.maxRows).volatile(),
  showHud: Schema.boolean().default(DEFAULT_CONFIG.showHud).volatile(),
})

/** Settings namespace owned by this plugin: its profile entry id (see `cordis.patch.yml`). */
export const SETTINGS_NAMESPACE = 'session-messages'

/**
 * Refuse a value the schema accepts but the chord matcher would misfire on.
 * `key` must be a single character (since it goes through
 * `KeyboardEvent.key.toLowerCase()`); an empty or multi-char string is a
 * legal string but the listener would never trigger. `maxRows` must be a
 * positive integer so the slice in the overlay is meaningful.
 * @param config - resolved section, schema-valid by construction.
 * @throws Error naming the field the chord would fail on.
 */
function assertServiceable(config: Config): void {
  const key = config.key.get()
  if (key.length !== 1) {
    throw new Error(`session-messages: key must be exactly one character (got "${key}")`)
  }
  const maxRows = config.maxRows.get()
  if (maxRows <= 0 || !Number.isInteger(maxRows)) {
    throw new Error(`session-messages: maxRows must be a positive integer (got ${String(maxRows)})`)
  }
}

/**
 * Publish the resolved configuration into every rendered index page and take
 * ownership of this entry's configuration page.
 * @param ctx - Host plugin context.
 * @param config - resolved configuration; fields are live volatile references,
 * so each `webserver/index-inject` reads the value current at emit time.
 */
export function apply(ctx: Context, config: Config): void {
  assertServiceable(config)

  ctx.on('webserver/index-inject', (table) => {
    table.push({
      kind: 'global',
      name: CONFIG_GLOBAL,
      // Unwrapped field by field: the page needs plain values, and spreading
      // the volatile references would publish wrapper objects instead.
      value: {
        key: config.key.get(),
        ctrl: config.ctrl.get(),
        alt: config.alt.get(),
        shift: config.shift.get(),
        meta: config.meta.get(),
        wheelInverted: config.wheelInverted.get(),
        maxRows: config.maxRows.get(),
        showHud: config.showHud.get(),
      },
    })
  })

  // This plugin draws its own configuration card on the Plugins page
  // (`plugins.bundle.config`, see src/client/index.ts), so the settings service
  // must not also generate a page for the entry. The settings service is part
  // of the base web bundle, so by the time any web profile loads this plugin
  // the service is already registered; `ctx.inject` waits for it.
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber))
  })
}
