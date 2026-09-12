/**
 * Where the bound `session-messages` settings scope lives once the service is
 * available.
 *
 * The scope is bound from a NESTED inject (see client/index.ts) rather than
 * from the module-level `inject` array: naming `settingsScope` there keeps the
 * whole plugin unmounted on any host without that service — the overlay would
 * vanish to gain a card. Nested, the card simply never appears on such a host
 * and everything else keeps working.
 *
 * The consequence is that the overlay mounts possibly BEFORE the scope
 * exists, and must re-read when it arrives. This holder is that seam: one
 * observable slot the overlay subscribes to, falling back to the global the
 * Node half injects into every index page until the scope shows up.
 */

import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { MessagesConfig } from '../shared.ts'

/** The scope once bound, undefined until the settings service is injected. */
let current: SettingsScope<MessagesConfig> | undefined

/** Listeners awaiting the scope (or a replacement of it). */
const listeners = new Set<() => void>()

/**
 * Publish the bound scope.
 * @param scope - the scope the settings service handed back.
 */
export function publishScope(scope: SettingsScope<MessagesConfig>): void {
  current = scope
  for (const listener of [...listeners]) listener()
}

/**
 * Observe the slot.
 * @param listener - called when the scope is published or replaced.
 * @returns the disposer.
 */
export function subscribeScope(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * Read the slot without subscribing.
 * @returns the bound scope, or undefined before the service is injected.
 */
export function readScope(): SettingsScope<MessagesConfig> | undefined {
  return current
}
