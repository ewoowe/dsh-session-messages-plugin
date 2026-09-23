/**
 * The live configuration the browser half renders from.
 *
 * Both consumers need it — the overlay list (its chord and `maxRows`) and the
 * header strip (its on/off switch) — and both mount in slots that can be ready
 * before the settings service is, so the resolution cannot live inside either
 * of them.
 *
 * Two levels of subscription: the holder, which fires when the bound form
 * appears or is replaced, and the form's own snapshot, which fires on every
 * edit. Until a form exists the value falls back to the global the Node half
 * publishes into every index page, so a host with no settings service still
 * gets the composed configuration rather than the defaults.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { CONFIG_GLOBAL, resolveConfig, type MessagesConfig } from '../shared.ts'
import { readForm, subscribeForm } from './settings-form-holder.ts'

/**
 * Resolve the current configuration, following later edits.
 * @returns the configuration to render from.
 */
export function useMessagesConfig(): MessagesConfig {
  const form = useSyncExternalStore(subscribeForm, readForm, readForm)
  const subscribe = useCallback(
    (listener: () => void) => (form === undefined ? () => {} : form.subscribe(listener)),
    [form],
  )
  const getSnapshot = useCallback(
    () => (form === undefined ? undefined : form.getSnapshot().value),
    [form],
  )
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return useMemo(
    () => value !== undefined
      ? resolveConfig(value)
      : resolveConfig((globalThis as Record<string, unknown>)[CONFIG_GLOBAL]),
    [value],
  )
}
