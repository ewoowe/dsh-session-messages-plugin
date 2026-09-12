/**
 * Node half of the session-messages plugin.
 *
 * The Loader imports this file by `main`. It owns the configuration Schema, so
 * a malformed `cordis.patch.yml` fails the plugin load loudly, publishes the
 * initial composition value into the page as a global for the browser half's
 * bootstrap fallback, and registers the configuration under the
 * `session-messages` settings namespace so the Settings → Plugins → Plugin
 * configuration page can read and write it.
 */
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
// Type-only merge: pulls in the 'webserver/index-inject' event signature.
import type {} from '@deepseek-ai/dsh-host-webserver'
// Type-only merge: pulls in the 'settings' service registration (installSection).
import type {} from '@deepseek-ai/dsh-settings'
import { CONFIG_GLOBAL, DEFAULT_CONFIG, type MessagesConfig } from './shared.ts'

export const name = 'session-messages'

/** Session-messages plugin configuration. */
export interface Config extends MessagesConfig {}

/** Validated session-messages configuration. */
export const Config: Schema<Config> = Schema.object({
  key: Schema.string().default(DEFAULT_CONFIG.key),
  ctrl: Schema.boolean().default(DEFAULT_CONFIG.ctrl),
  alt: Schema.boolean().default(DEFAULT_CONFIG.alt),
  shift: Schema.boolean().default(DEFAULT_CONFIG.shift),
  meta: Schema.boolean().default(DEFAULT_CONFIG.meta),
  wheelInverted: Schema.boolean().default(DEFAULT_CONFIG.wheelInverted),
  maxRows: Schema.number().default(DEFAULT_CONFIG.maxRows),
  showHud: Schema.boolean().default(DEFAULT_CONFIG.showHud),
})

/** Settings namespace owned by this plugin. */
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
  const key = config.key
  if (key.length !== 1) {
    throw new Error(`session-messages: key must be exactly one character (got "${key}")`)
  }
  if (config.maxRows <= 0 || !Number.isInteger(config.maxRows)) {
    throw new Error(`session-messages: maxRows must be a positive integer (got ${String(config.maxRows)})`)
  }
}

/**
 * Publish the resolved configuration into every rendered index page and
 * register it under the settings namespace so the configuration page can edit
 * it.
 * @param ctx - Host plugin context.
 * @param config - composition-base configuration from `cordis.patch.yml`.
 */
export function apply(ctx: Context, config: Config): void {
  /**
   * The authoritative value source. `installSection` hands `setSource` a THUNK
   * (`() => T`), not a value — see `SettingsSectionHooks.setSource` in
   * packages/settings. Storing the argument as if it were the value makes this
   * a function, and spreading a function yields `{}`, which silently published
   * an empty configuration to the page. Call it; never spread it.
   */
  let readSource: () => Config = () => config

  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'global', name: CONFIG_GLOBAL, value: { ...readSource() } })
  })

  // Register the namespace. The settings service is part of the base web
  // bundle, so by the time any web profile loads this plugin the service is
  // already registered; `ctx.inject` waits for it.
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, SETTINGS_NAMESPACE, Config, config, {
      validate: assertServiceable,
      setSource: (read) => {
        readSource = read
      },
      // Nothing is derived from the current config on the Node side, so no
      // onChange work is required; the next `webserver/index-inject` reads
      // the updated holder, and the browser-side overlay subscribes to the
      // settings scope directly.
      onChange: () => {},
    })
  })
}
