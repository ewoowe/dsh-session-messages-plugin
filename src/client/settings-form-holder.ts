/**
 * Where the `session-messages` configuration form lives once the settings
 * service is available.
 *
 * The form is bound from a NESTED inject (see client/index.ts) rather than from
 * the module-level `inject` array: naming `configForms` there keeps the whole
 * plugin unmounted on any host without that service — the overlay would vanish
 * to gain a card. Nested, the card simply never appears on such a host and
 * everything else keeps working.
 *
 * The consequence is that the overlay mounts possibly BEFORE the form exists,
 * and must re-read when it arrives. This holder is that seam: one observable
 * slot the overlay subscribes to, falling back to the global the Node half
 * injects into every index page until the form shows up.
 */
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { MessagesConfig } from '../shared.ts'

/** The form once bound, undefined until the settings service is injected. */
let current: ConfigForm<MessagesConfig> | undefined

/** Listeners awaiting the form (or a replacement of it). */
const listeners = new Set<() => void>()

/**
 * Publish the bound form.
 * @param form - the form the settings service handed back.
 */
export function publishForm(form: ConfigForm<MessagesConfig>): void {
  current = form
  for (const listener of [...listeners]) listener()
}

/**
 * Observe the slot.
 * @param listener - called when the form is published or replaced.
 * @returns the disposer.
 */
export function subscribeForm(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * Read the slot without subscribing.
 * @returns the bound form, or undefined before the service is injected.
 */
export function readForm(): ConfigForm<MessagesConfig> | undefined {
  return current
}
