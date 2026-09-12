/**
 * The plugin's configuration shape, shared by both halves.
 *
 * The Node half owns the Schema (the Loader validates the patch file against
 * it) and publishes the resolved values into the page as a global; the browser
 * half reads that global and falls back to these same defaults when the
 * injection is absent. Both halves therefore agree on one shape without the
 * browser bundling its own copy of the Schema.
 */

/** One resolved session-messages configuration. */
export interface MessagesConfig {
  /** `KeyboardEvent.key` in lowercase that opens the overlay (for example `s`). */
  key: string
  /** Whether the Control modifier must be held. */
  ctrl: boolean
  /** Whether the Alt modifier must be held. */
  alt: boolean
  /** Whether the Shift modifier must be held. */
  shift: boolean
  /** Whether the Meta modifier (Cmd on macOS, Win on Windows) must be held. */
  meta: boolean
  /**
   * Whether scrolling up moves the highlight down. Off (the default) reads the
   * wheel as direct movement: up scrolls to the older row above, down to the
   * newer row below. On suits a reader whose device reports inverted deltas.
   */
  wheelInverted: boolean
  /** Maximum number of rows rendered in the overlay. */
  maxRows: number
  /**
   * Whether the top-center viewport strip is shown: an always-on readout of the
   * message currently under the fold, with its clock, usage and duration. Off
   * by default — it is an extra layer over the transcript, so it is opt-in.
   */
  showHud: boolean
}

/** Defaults every consumer falls back to; they mirror the Schema defaults. */
export const DEFAULT_CONFIG: MessagesConfig = {
  key: 's',
  ctrl: true,
  alt: false,
  shift: false,
  meta: false,
  wheelInverted: false,
  maxRows: 50,
  showHud: false,
}

/** `globalThis` property the Node half writes the resolved configuration to. */
export const CONFIG_GLOBAL = '__DSH_SESSION_MESSAGES_CONFIG__'

/**
 * Fill every missing field from {@link DEFAULT_CONFIG}.
 * @param value - raw value read from the page, untrusted shape.
 * @returns a complete configuration.
 */
export function resolveConfig(value: unknown): MessagesConfig {
  if (typeof value !== 'object' || value === null) return DEFAULT_CONFIG
  const raw = value as Record<string, unknown>
  const text = (field: keyof MessagesConfig): string | undefined =>
    typeof raw[field] === 'string' ? raw[field] as string : undefined
  const flag = (field: keyof MessagesConfig): boolean | undefined =>
    typeof raw[field] === 'boolean' ? raw[field] as boolean : undefined
  const count = (field: keyof MessagesConfig): number | undefined =>
    typeof raw[field] === 'number' && Number.isFinite(raw[field]) ? raw[field] as number : undefined
  return {
    key: text('key') ?? DEFAULT_CONFIG.key,
    ctrl: flag('ctrl') ?? DEFAULT_CONFIG.ctrl,
    alt: flag('alt') ?? DEFAULT_CONFIG.alt,
    shift: flag('shift') ?? DEFAULT_CONFIG.shift,
    meta: flag('meta') ?? DEFAULT_CONFIG.meta,
    wheelInverted: flag('wheelInverted') ?? DEFAULT_CONFIG.wheelInverted,
    maxRows: count('maxRows') ?? DEFAULT_CONFIG.maxRows,
    showHud: flag('showHud') ?? DEFAULT_CONFIG.showHud,
  }
}
