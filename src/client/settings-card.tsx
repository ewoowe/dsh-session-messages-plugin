/**
 * The session-messages settings card.
 *
 * Stages edits over the `session-messages` settings namespace and writes them
 * on save. Lives in this package rather than the monorepo's
 * `dsh-client-ui-settings-plugins` because that package's shared
 * `CardForm`/`PluginCard` pair has no boolean field type — and chord
 * modifiers are the only field-shape difference this card needs, so a few
 * hand-rolled inputs and the primitives' `Switch` are simpler than borrowing
 * the shared form machinery.
 */
import {
  useCallback, useEffect, useRef, useState, useSyncExternalStore,
  type CSSProperties, type ReactNode,
} from 'react'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { IconChevronDownOutline14, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { DEFAULT_CONFIG, type MessagesConfig } from '../shared.ts'
import type { MessagesKey } from './locales.ts'

/** SettingsScope is the typed window onto the Host document. */
export type MessagesSettingsScope = SettingsScope<MessagesConfig>

/** One draft value pending a save. Undefined means the field is unchanged. */
type Draft = {
  key?: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
  wheelInverted?: boolean
  maxRows?: number
  showHud?: boolean
}

/** Field ids the card edits; iterated in render order. */
const FIELDS = ['key', 'ctrl', 'alt', 'shift', 'meta', 'wheelInverted', 'maxRows', 'showHud'] as const
type Field = typeof FIELDS[number]

interface SettingsCardProps {
  /** Bound settings scope for the `session-messages` namespace. Absent renders the unavailable state. */
  scope: MessagesSettingsScope | undefined
  /** Locale translate. */
  t: (key: MessagesKey, params?: Record<string, unknown>) => string
}

/**
 * Read the current scope snapshot through `useSyncExternalStore` so the card
 * re-renders whenever the Host document changes (including a peer write from
 * elsewhere in the same surface, in case a future change ever touches this
 * namespace).
 */
/**
 * Snapshot reported when no scope is bound. The card already renders its
 * `unavailable` state for a snapshot with no value, so a missing scope degrades
 * to that message instead of throwing inside the slot's error boundary and
 * taking the whole card list down with it.
 */
const NO_SCOPE_SNAPSHOT = {
  status: 'unavailable',
  value: undefined,
  revision: undefined,
  writable: false,
  mode: 'memory',
} as unknown as SettingsScopeSnapshot<MessagesConfig>

function useScope(scope: MessagesSettingsScope | undefined): SettingsScopeSnapshot<MessagesConfig> {
  return useSyncExternalStore(
    (listener) => (scope === undefined ? () => {} : scope.subscribe(listener)),
    () => (scope === undefined ? NO_SCOPE_SNAPSHOT : scope.getSnapshot()),
    () => (scope === undefined ? NO_SCOPE_SNAPSHOT : scope.getSnapshot()),
  )
}

/** Local validation that mirrors the Host-side `assertServiceable` in src/index.ts. */
function isFieldInvalid(
  field: Field,
  value: unknown,
  invalidLabel: string,
  invalidMaxRowsLabel: string,
): string | null {
  if (field === 'key') {
    return typeof value === 'string' && value.length === 1 ? null : invalidLabel
  }
  if (field === 'maxRows') {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? null : invalidMaxRowsLabel
  }
  return null
}

/** True when the field's stored value differs from the schema default. */
function isFieldOverridden(snapshot: SettingsScopeSnapshot<MessagesConfig>, field: Field): boolean {
  const user = snapshot.user as Record<string, unknown> | undefined
  return user !== undefined && Object.hasOwn(user, field)
}

/**
 * Read one field of a configuration by name.
 *
 * `MessagesConfig` carries no index signature, so casting it to
 * `Record<string, unknown>` is rejected outright. Switching over the field union
 * keeps the lookup checked — adding a field to `FIELDS` without a case here is a
 * compile error, where `as unknown as Record<...>` would silently return
 * undefined.
 * @param config - the configuration to read.
 * @param field - the field to read.
 * @returns the field's value.
 */
function fieldValue(config: MessagesConfig, field: Field): unknown {
  switch (field) {
    case 'key': return config.key
    case 'ctrl': return config.ctrl
    case 'alt': return config.alt
    case 'shift': return config.shift
    case 'meta': return config.meta
    case 'wheelInverted': return config.wheelInverted
    case 'maxRows': return config.maxRows
    case 'showHud': return config.showHud
  }
}

export function MessagesSettingsCard(props: SettingsCardProps): ReactNode {
  // A missing `t` would throw on the very first label and take the whole card
  // down inside the slot's error boundary. Falling back to key-named labels
  // keeps the hooks below unconditional — an early return here would render
  // zero hooks on the first pass and one on the next.
  const { scope } = props
  const t: (key: MessagesKey, params?: Record<string, unknown>) => string =
    typeof props.t === 'function' ? props.t : (key) => String(key)
  const snapshot = useScope(scope)
  const [draft, setDraft] = useState<Draft>({})
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  /**
   * Collapsed by default, matching the other cards in this section: the list is
   * a scan of several plugins, so an always-open card pushes the rest off
   * screen. Disclosure is card-local reading state — the Host has no stake in
   * which one is open.
   */
  const [open, setOpen] = useState(false)
  /** Pointer hover, which tints the border exactly as the peer plugin cards do. */
  const [hover, setHover] = useState(false)
  /** Whether a save is in flight, so it can collapse only after it settles. */
  const saveStarted = useRef(false)

  // An external write (or the first mount, once status flips from loading to
  // ready) drops a held draft that already matches the canonical value so the
  // save button does not stay armed against stale text.
  useEffect(() => {
    // Hoisted to a const: narrowing a property does not survive into the
    // setDraft callback, so `snapshot.value` would widen back to `| undefined`.
    const value = snapshot.value
    if (value === undefined) return
    setDraft((previous) => {
      let changed = false
      const next: Draft = { ...previous }
      for (const field of FIELDS) {
        const staged = previous[field]
        if (staged === undefined) continue
        const current = fieldValue(value, field)
        if (staged === current) {
          delete next[field]
          changed = true
        }
      }
      return changed ? next : previous
    })
  }, [snapshot])

  const current = snapshot.value
  if (current === undefined) {
    return (
      <li
        style={CARD_STYLE(open, hover)}
        onMouseEnter={() => { setHover(true) }}
        onMouseLeave={() => { setHover(false) }}
      >
        <div style={HEADER_LAYOUT_STYLE}>
          <span style={HEAD_TEXT_STYLE}>
            <span style={TITLE_STYLE}>{t('settingsTitle')}</span>
            <span style={DESC_STYLE}>{t('unavailable')}</span>
          </span>
        </div>
      </li>
    )
  }

  // What each field would become on save: a staged edit takes priority, then
  // the stored value, then the schema default.
  const effective = (field: Field): unknown => {
    const staged = draft[field]
    if (staged !== undefined) return staged
    return fieldValue(current, field) ?? fieldValue(DEFAULT_CONFIG, field)
  }

  const stage = (field: Field, value: unknown): void => {
    setFailed(false)
    setDraft((previous) => {
      const live = fieldValue(current, field) ?? fieldValue(DEFAULT_CONFIG, field)
      if (value === live) {
        const next = { ...previous }
        delete next[field]
        return next
      }
      return { ...previous, [field]: value as never }
    })
  }

  const resetField = useCallback(async (field: Field): Promise<void> => {
    setFailed(false)
    setDraft((previous) => {
      const next = { ...previous }
      delete next[field]
      return next
    })
    // No scope means no document to clear: the draft is dropped and the card
    // has already rendered its unavailable state.
    if (scope === undefined) return
    if (isFieldOverridden(snapshot, field)) {
      try { await scope.unset(field) } catch { /* the next snapshot reports the rejection */ }
    }
  }, [scope, snapshot])

  const dirty = FIELDS.some((field) => draft[field] !== undefined)
  const invalid = FIELDS.some((field) => {
    const staged = draft[field]
    if (staged === undefined) return false
    return isFieldInvalid(field, staged, t('invalidKey'), t('invalidMaxRows')) !== null
  })
  const writable = snapshot.writable && !saving

  const save = async (): Promise<void> => {
    // Without a scope there is nothing to write against; `writable` already
    // reflects that, but the guard also narrows `scope` for the calls below.
    if (scope === undefined || !dirty || invalid || !writable) return
    setSaving(true)
    setFailed(false)
    let landed = true
    try {
      for (const field of FIELDS) {
        const staged = draft[field]
        if (staged === undefined) continue
        try {
          await scope.set(field, staged as never)
        } catch {
          landed = false
        }
      }
      if (landed) setDraft({})
      setFailed(!landed)
    } finally {
      setSaving(false)
    }
  }

  const discard = (): void => {
    setDraft({})
    setFailed(false)
  }

  // Collapse only after the write settles: a rejected save keeps its error and
  // the staged values on screen for correction. Matches PluginCard's behavior.
  useEffect(() => {
    if (saving) {
      saveStarted.current = true
      return
    }
    if (!saveStarted.current) return
    saveStarted.current = false
    if (!dirty && !failed) setOpen(false)
  }, [dirty, failed, saving])

  return (
    <li
      style={CARD_STYLE(open, hover)}
      onMouseEnter={() => { setHover(true) }}
      onMouseLeave={() => { setHover(false) }}
    >
      <button
        type="button"
        style={HEADER_BUTTON_STYLE}
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${t('settingsTitle')}`}
        onClick={() => { setOpen(!open) }}
      >
        <span style={HEAD_TEXT_STYLE}>
          <span style={TITLE_STYLE}>{t('settingsTitle')}</span>
          <span style={DESC_STYLE}>{t('settingsDescription')}</span>
        </span>
        {dirty && <span style={PENDING_STYLE}><Tag tone="neutral">{t('unsaved')}</Tag></span>}
        <span style={CHEVRON_STYLE(open)} aria-hidden="true">
          <IconChevronDownOutline14 />
        </span>
      </button>

      {open ? (
        <div style={BODY_STYLE}>
          {!writable && <p style={READ_ONLY_STYLE} role="status">{t('readOnly')}</p>}

          <KeyField
            field="key"
            label={t('fieldKey')}
            hint={t('fieldKeyHint')}
            invalidLabel={t('invalidKey')}
            overriddenLabel={t('overridden')}
            resetLabel={t('reset')}
            value={String(effective('key') ?? '')}
            staged={draft.key}
            onChange={(text) => { stage('key', text) }}
            onReset={() => { void resetField('key') }}
            overridden={isFieldOverridden(snapshot, 'key') && draft.key === undefined}
            disabled={!writable}
            divider={false}
          />

          <SwitchRow
            label={t('fieldCtrl')}
            value={Boolean(effective('ctrl'))}
            staged={draft.ctrl}
            onChange={(next) => { stage('ctrl', next) }}
            onReset={() => { void resetField('ctrl') }}
            overridden={isFieldOverridden(snapshot, 'ctrl') && draft.ctrl === undefined}
            overriddenLabel={t('overridden')}
            resetLabel={t('reset')}
            disabled={!writable}
            divider
          />
          <SwitchRow
            label={t('fieldAlt')}
            value={Boolean(effective('alt'))}
            staged={draft.alt}
            onChange={(next) => { stage('alt', next) }}
            onReset={() => { void resetField('alt') }}
            overridden={isFieldOverridden(snapshot, 'alt') && draft.alt === undefined}
            overriddenLabel={t('overridden')}
            resetLabel={t('reset')}
            disabled={!writable}
            divider
          />
          <SwitchRow
            label={t('fieldShift')}
            value={Boolean(effective('shift'))}
            staged={draft.shift}
            onChange={(next) => { stage('shift', next) }}
            onReset={() => { void resetField('shift') }}
            overridden={isFieldOverridden(snapshot, 'shift') && draft.shift === undefined}
            overriddenLabel={t('overridden')}
            resetLabel={t('reset')}
            disabled={!writable}
            divider
          />
          <SwitchRow
            label={t('fieldMeta')}
            value={Boolean(effective('meta'))}
            staged={draft.meta}
            onChange={(next) => { stage('meta', next) }}
            onReset={() => { void resetField('meta') }}
            overridden={isFieldOverridden(snapshot, 'meta') && draft.meta === undefined}
            overriddenLabel={t('overridden')}
            resetLabel={t('reset')}
            disabled={!writable}
            divider
          />

          <SwitchRow
            label={t(Boolean(effective('wheelInverted')) ? 'fieldWheelDown' : 'fieldWheelUp')}
            value={Boolean(effective('wheelInverted'))}
            staged={draft.wheelInverted}
            onChange={(next) => { stage('wheelInverted', next) }}
            onReset={() => { void resetField('wheelInverted') }}
            overridden={isFieldOverridden(snapshot, 'wheelInverted') && draft.wheelInverted === undefined}
            overriddenLabel={t('overridden')}
            resetLabel={t('reset')}
            disabled={!writable}
            divider
          />

          <KeyField
            field="maxRows"
            numeric
            label={t('fieldMaxRows')}
            hint={t('fieldMaxRowsHint')}
            invalidLabel={t('invalidMaxRows')}
            overriddenLabel={t('overridden')}
            resetLabel={t('reset')}
            value={effective('maxRows') !== undefined ? String(effective('maxRows')) : ''}
            staged={draft.maxRows}
            onChange={(text) => {
              const trimmed = text.trim()
              if (trimmed === '') { stage('maxRows', DEFAULT_CONFIG.maxRows); return }
              const parsed = Number(trimmed)
              stage('maxRows', Number.isFinite(parsed) ? parsed : Number.NaN)
            }}
            onReset={() => { void resetField('maxRows') }}
            overridden={isFieldOverridden(snapshot, 'maxRows') && draft.maxRows === undefined}
            disabled={!writable}
            divider
          />

          <SwitchRow
            label={t('fieldShowHud')}
            value={Boolean(effective('showHud'))}
            staged={draft.showHud}
            onChange={(next) => { stage('showHud', next) }}
            onReset={() => { void resetField('showHud') }}
            overridden={isFieldOverridden(snapshot, 'showHud') && draft.showHud === undefined}
            overriddenLabel={t('overridden')}
            resetLabel={t('reset')}
            disabled={!writable}
            divider
          />

          <div style={FOOTER_STYLE}>
            {failed && <p style={FAILED_STYLE} role="status">{t('saveFailed')}</p>}
            <button
              type="button"
              onClick={discard}
              disabled={!dirty || saving}
              style={BUTTON_STYLE(!dirty || saving, false)}
            >
              {t('discard')}
            </button>
            <button
              type="button"
              onClick={() => { void save() }}
              disabled={!dirty || invalid || !writable}
              style={BUTTON_STYLE(!dirty || invalid || !writable, true)}
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
}

// --- Field controls -------------------------------------------------------

interface KeyFieldProps {
  field: Field
  label: string
  hint: string
  invalidLabel: string
  overriddenLabel: string
  resetLabel: string
  value: string
  staged: unknown
  onChange: (text: string) => void
  onReset: () => void
  overridden: boolean
  numeric?: boolean
  disabled: boolean
  /** Whether a hairline separates this field from the one above it. */
  divider: boolean
}

function KeyField(props: KeyFieldProps): ReactNode {
  const stagedString = props.staged !== undefined ? String(props.staged) : null
  const invalid = stagedString !== null
    && isFieldInvalid(props.field, props.staged, props.invalidLabel, props.invalidLabel) !== null
    && !(props.field === 'maxRows' && props.staged === DEFAULT_CONFIG.maxRows)
  const dirty = stagedString !== null && stagedString !== props.value
  const showOverridden = props.overridden && !dirty
  return (
    <div style={FIELD_STYLE(props.divider)}>
      <div style={FIELD_HEAD_STYLE}>
        <label htmlFor={`session-messages-settings-${props.field}`} style={LABEL_STYLE}>{props.label}</label>
        {(showOverridden || dirty) && (
          <span style={BADGES_STYLE}>
            {showOverridden && <Tag tone="neutral">{props.overriddenLabel}</Tag>}
            <button type="button" onClick={props.onReset} disabled={props.disabled} style={RESET_BTN_STYLE}>
              {props.resetLabel}
            </button>
          </span>
        )}
      </div>
      <input
        id={`session-messages-settings-${props.field}`}
        type="text"
        {...props.numeric === true ? { inputMode: 'numeric' as const } : {}}
        value={stagedString ?? props.value}
        onChange={(event) => { props.onChange(event.target.value) }}
        disabled={props.disabled}
        aria-invalid={invalid}
        style={INPUT_STYLE(invalid)}
      />
      <p style={invalid ? INVALID_HINT_STYLE : HINT_STYLE}>
        {invalid ? props.invalidLabel : props.hint}
      </p>
    </div>
  )
}

interface SwitchRowProps {
  label: string
  value: boolean
  staged: unknown
  onChange: (next: boolean) => void
  onReset: () => void
  overridden: boolean
  overriddenLabel: string
  resetLabel: string
  disabled: boolean
  /** Whether a hairline separates this field from the one above it. */
  divider: boolean
}

function SwitchRow(props: SwitchRowProps): ReactNode {
  const dirty = props.staged !== undefined && Boolean(props.staged) !== props.value
  const showOverridden = props.overridden && !dirty
  return (
    <div style={FIELD_STYLE(props.divider)}>
      <div style={FIELD_HEAD_STYLE}>
        <label style={LABEL_STYLE}>{props.label}</label>
        <span style={BADGES_STYLE}>
          {showOverridden && <Tag tone="neutral">{props.overriddenLabel}</Tag>}
          <button type="button" onClick={props.onReset} disabled={props.disabled} style={RESET_BTN_STYLE}>
            {props.resetLabel}
          </button>
        </span>
      </div>
      <div style={SWITCH_ROW_BODY_STYLE}>
        <Switch
          checked={props.staged !== undefined ? Boolean(props.staged) : props.value}
          onChange={props.onChange}
          label={props.label}
          disabled={props.disabled}
        />
      </div>
    </div>
  )
}

// --- Styles (inline; mirror `PluginCard.module.css` and `fields.module.css`
// so this card is indistinguishable from the section's other plugin cards) ---

const CARD_STYLE = (open: boolean, hover: boolean): CSSProperties => ({
  listStyle: 'none',
  border: '0.5px solid ' + (open || hover
    ? 'var(--dsw-alias-label-dimmed)'
    : 'var(--dsw-alias-border-l4)'),
  borderRadius: 16,
  background: open ? 'var(--dsw-alias-bg-layer-2)' : 'var(--dsw-alias-bg-layer-3)',
  transition: 'border-color .16s, background .16s',
})

/** Header geometry shared by the disclosing button and the unavailable state. */
const HEADER_LAYOUT_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
}

/** The whole header is one button: title stacked over description, chevron at the end. */
const HEADER_BUTTON_STYLE: CSSProperties = {
  ...HEADER_LAYOUT_STYLE,
  appearance: 'none',
  border: 0,
  background: 'none',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'start',
  cursor: 'pointer',
}

const HEAD_TEXT_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const CHEVRON_STYLE = (open: boolean): CSSProperties => ({
  flex: 'none',
  display: 'inline-flex',
  color: 'var(--dsw-alias-label-tertiary)',
  transition: 'transform .16s',
  transform: open ? 'rotate(180deg)' : 'none',
})

/** Placement only; the capsule geometry and palette come from `Tag`. */
const PENDING_STYLE: CSSProperties = {
  flex: 'none',
  display: 'inline-flex',
}

const TITLE_STYLE: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  lineHeight: 1.4,
  color: 'var(--dsw-alias-label-primary)',
}

const DESC_STYLE: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-tertiary)',
}

const BODY_STYLE: CSSProperties = {
  borderTop: '0.5px solid var(--dsw-alias-border-l2)',
  margin: '0 16px',
  paddingBottom: 8,
}

const READ_ONLY_STYLE: CSSProperties = {
  margin: '12px 0 0',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-tertiary)',
}

const FIELD_STYLE = (divider: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '12px 0',
  ...(divider ? { borderTop: '0.5px solid var(--dsw-alias-border-l2)' } : {}),
})

const FIELD_HEAD_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const LABEL_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-primary)',
}

const BADGES_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}

const RESET_BTN_STYLE: CSSProperties = {
  border: 'none',
  background: 'none',
  padding: 0,
  font: 'inherit',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-secondary)',
  cursor: 'pointer',
}

const INPUT_STYLE = (invalid: boolean): CSSProperties => ({
  height: 34,
  padding: '0 12px',
  border: '0.5px solid ' + (invalid
    ? 'var(--dsw-alias-label-error)'
    : 'var(--dsw-alias-border-l4)'),
  borderRadius: 8,
  background: 'var(--dsw-alias-bg-layer-3)',
  font: 'inherit',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-primary)',
  outline: 'none',
})

const HINT_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-tertiary)',
}

const INVALID_HINT_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-error)',
}

const SWITCH_ROW_BODY_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 0',
}

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 0 4px',
  borderTop: '0.5px solid var(--dsw-alias-border-l2)',
}

const FAILED_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-error)',
}

const BUTTON_STYLE = (disabled: boolean, primary: boolean): CSSProperties => ({
  appearance: 'none',
  padding: '5px 14px',
  border: primary ? '1px solid transparent' : '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  background: primary ? 'var(--dsw-alias-label-primary)' : 'none',
  color: primary ? 'var(--dsw-alias-bg-layer-3)' : 'var(--dsw-alias-label-secondary)',
  font: 'inherit',
  fontSize: 13,
  lineHeight: 1.5,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.4 : 1,
})
