import type { KeyMap, RemoteAction, Settings } from './types'

const SETTINGS_KEY = 'ultra-iptv:settings'
const LAST_CHANNEL_KEY = 'ultra-iptv:last-channel'

export const DEFAULT_KEYMAP: KeyMap = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  ok: ['Enter', 'NumpadEnter', 'Select'],
  back: ['Escape', 'Backspace', 'GoBack', 'BrowserBack'],
  menu: ['ContextMenu', 'm', 'F2'],
  chUp: ['PageUp', 'ChannelUp', '+'],
  chDown: ['PageDown', 'ChannelDown', '-'],
  info: ['i', 'Info', 'F1'],
}

export const ACTION_LABELS: Record<RemoteAction, string> = {
  up: 'Вверх',
  down: 'Вниз',
  left: 'Влево',
  right: 'Вправо',
  ok: 'ОК / Выбор',
  back: 'Назад',
  menu: 'Меню / Настройки',
  chUp: 'Канал +',
  chDown: 'Канал −',
  info: 'Инфо',
}

export const DEFAULT_SETTINGS: Settings = {
  viewMode: 'grid',
  autoplayLast: true,
  epgUrlOverride: '',
  keyMap: DEFAULT_KEYMAP,
  themeMode: 'cinema',
  focusColor: 'orange',
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      keyMap: { ...DEFAULT_KEYMAP, ...(parsed.keyMap ?? {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export interface LastChannel {
  id: string
  url: string
  name: string
  group: string
}

export function loadLastChannel(): LastChannel | null {
  try {
    const raw = localStorage.getItem(LAST_CHANNEL_KEY)
    return raw ? (JSON.parse(raw) as LastChannel) : null
  } catch {
    return null
  }
}

export function saveLastChannel(value: LastChannel) {
  localStorage.setItem(LAST_CHANNEL_KEY, JSON.stringify(value))
}

export function keyLabel(key: string): string {
  const labels: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ' ': 'Space',
    Escape: 'Esc',
  }
  return labels[key] ?? key
}