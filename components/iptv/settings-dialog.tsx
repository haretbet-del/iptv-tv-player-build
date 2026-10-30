'use client'

import {
  Check,
  Database,
  Keyboard,
  LayoutGrid,
  List,
  ListVideo,
  Monitor,
  Palette,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { captureNextKey } from '@/hooks/use-remote'
import { ACTION_LABELS, DEFAULT_KEYMAP, keyLabel } from '@/lib/iptv/settings'
import type { FocusColor, RemoteAction, Settings, ThemeMode } from '@/lib/iptv/types'
import { TvDialog } from './tv-dialog'

interface SettingsDialogProps {
  settings: Settings
  onChange: (settings: Settings) => void
  onClose: () => void
  onOpenPlaylist: () => void
  onRefreshEpg: (epgUrlOverride: string) => void
  epgStatus: { loading: boolean; progress: number; info: string }
  playlistName?: string
  playlistEpgUrl?: string
}

const THEME_OPTIONS: {
  mode: ThemeMode
  label: string
  hint: string
  preview: string
  accent: string
}[] = [
  {
    mode: 'cinema',
    label: 'Кино',
    hint: 'Тёплый тёмный',
    preview: 'bg-gradient-to-br from-[#1a1512] via-[#2a211a] to-[#3a2d22]',
    accent: 'bg-[#e8a95c]',
  },
  {
    mode: 'space',
    label: 'Космос',
    hint: 'Глубокий синий',
    preview: 'bg-gradient-to-br from-[#0b1026] via-[#131a3a] to-[#1e2a5e]',
    accent: 'bg-[#6c8cff]',
  },
  {
    mode: 'cyberpunk',
    label: 'Киберпанк',
    hint: 'Неон и контраст',
    preview: 'bg-gradient-to-br from-[#12071f] via-[#2a0a3d] to-[#4a0e5c]',
    accent: 'bg-[#ff2ec4]',
  },
  {
    mode: 'light',
    label: 'Светлая',
    hint: 'Для дневного света',
    preview: 'bg-gradient-to-br from-[#f7f7fb] via-[#ececf4] to-[#dcdce8]',
    accent: 'bg-[#3b6cff]',
  },
]

const FOCUS_COLOR_OPTIONS: {
  color: FocusColor
  label: string
  swatch: string
  ring: string
}[] = [
  {
    color: 'orange',
    label: 'Оранжевый',
    swatch: 'bg-orange-500',
    ring: 'ring-orange-500',
  },
  {
    color: 'green',
    label: 'Зелёный',
    swatch: 'bg-emerald-500',
    ring: 'ring-emerald-500',
  },
  {
    color: 'blue',
    label: 'Синий',
    swatch: 'bg-blue-500',
    ring: 'ring-blue-500',
  },
  {
    color: 'red',
    label: 'Красный',
    swatch: 'bg-red-500',
    ring: 'ring-red-500',
  },
]

export function SettingsDialog({
  settings,
  onChange,
  onClose,
  onOpenPlaylist,
  onRefreshEpg,
  epgStatus,
  playlistName,
  playlistEpgUrl,
}: SettingsDialogProps) {
  const [capturing, setCapturing] = useState<RemoteAction | null>(null)
  const [epgUrl, setEpgUrl] = useState(settings.epgUrlOverride)

  useEffect(() => () => captureNextKey(null), [])

  const startCapture = (action: RemoteAction) => {
    setCapturing(action)
    captureNextKey((key) => {
      const keyMap = { ...settings.keyMap }
      for (const a of Object.keys(keyMap) as RemoteAction[]) {
        keyMap[a] = keyMap[a].filter((k) => k !== key)
      }
      keyMap[action] = [key, ...keyMap[action]].slice(0, 3)
      onChange({ ...settings, keyMap })
      setCapturing(null)
    })
  }

  const section = 'flex flex-col gap-4'
  const heading = 'flex items-center gap-3 text-2xl font-semibold'
  const choice = (active: boolean) =>
    cn(
      'flex flex-1 items-center gap-4 rounded-2xl border-2 px-6 py-5 text-left text-xl',
      active ? 'border-primary bg-primary/10' : 'border-transparent bg-secondary',
    )

  return (
    <TvDialog title="Настройки" description="Управление: стрелки, ОК, Назад" onClose={onClose}>
      <div className="flex flex-col gap-10">
        <section className={section} aria-labelledby="view-heading">
          <h3 id="view-heading" className={heading}>
            <LayoutGrid aria-hidden="true" className="size-6 text-primary" />
            Вид списка каналов
          </h3>
          <div className="flex gap-4" role="radiogroup" aria-labelledby="view-heading">
            {(
              [
                { mode: 'grid', label: 'Сетка / Плитка', hint: 'Крупные логотипы', Icon: LayoutGrid },
                { mode: 'compact', label: 'Компактная строка', hint: 'Только текст', Icon: List },
              ] as const
            ).map(({ mode, label, hint, Icon }) => {
              const active = settings.viewMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-nav
                  data-nav-autofocus={active ? true : undefined}
                  onClick={() => onChange({ ...settings, viewMode: mode })}
                  className={choice(active)}
                >
                  <Icon aria-hidden="true" className="size-8 shrink-0" />
                  <span className="flex flex-1 flex-col">
                    <span className="font-semibold">{label}</span>
                    <span className="text-base text-muted-foreground">{hint}</span>
                  </span>
                  {active && <Check aria-hidden="true" className="size-6 text-primary" />}
                </button>
              )
            })}
          </div>
        </section>

        <section className={section} aria-labelledby="theme-heading">
          <h3 id="theme-heading" className={heading}>
            <Palette aria-hidden="true" className="size-6 text-primary" />
            Тема оформления
          </h3>
          <p className="text-base text-muted-foreground">Выберите общий стиль интерфейса плеера.</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4" role="radiogroup" aria-labelledby="theme-heading">
            {THEME_OPTIONS.map(({ mode, label, hint, preview, accent }) => {
              const active = settings.themeMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-nav
                  data-nav-autofocus={active ? true : undefined}
                  onClick={() => onChange({ ...settings, themeMode: mode })}
                  className={cn(
                    'group flex flex-col gap-3 rounded-2xl border-2 p-3 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary/10'
                      : 'border-transparent bg-secondary hover:border-primary/40',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'relative flex h-24 w-full items-center justify-center overflow-hidden rounded-xl ring-1 ring-black/10',
                      preview,
                    )}
                  >
                    <span className={cn('size-10 rounded-full shadow-lg', accent)} />
                    {active && (
                      <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check aria-hidden="true" className="size-4" />
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-lg font-semibold">{label}</span>
                    <span className="text-sm text-muted-foreground">{hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className={section} aria-labelledby="focus-heading">
          <h3 id="focus-heading" className={heading}>
            <Sparkles aria-hidden="true" className="size-6 text-primary" />
            Цвет рамки фокуса
          </h3>
          <p className="text-base text-muted-foreground">
            Цвет подсветки выбранного элемента при управлении пультом.
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4" role="radiogroup" aria-labelledby="focus-heading">
            {FOCUS_COLOR_OPTIONS.map(({ color, label, swatch, ring }) => {
              const active = settings.focusColor === color
              return (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-nav
                  data-nav-autofocus={active ? true : undefined}
                  onClick={() => onChange({ ...settings, focusColor: color })}
                  className={cn(
                    'flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary/10'
                      : 'border-transparent bg-secondary hover:border-primary/40',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-12 shrink-0 items-center justify-center rounded-xl ring-4 ring-offset-2 ring-offset-background',
                      swatch,
                      active ? ring : 'ring-transparent',
                    )}
                  >
                    {active && <Check aria-hidden="true" className="size-6 text-white" />}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-lg font-semibold">{label}</span>
                    <span className="text-sm text-muted-foreground">
                      {active ? 'Выбрано' : 'Рамка фокуса'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className={section} aria-labelledby="playback-heading">
          <h3 id="playback-heading" className={heading}>
            <ListVideo aria-hidden="true" className="size-6 text-primary" />
            Плейлист и запуск
          </h3>
          <div className="flex gap-4">
            <button
              type="button"
              data-nav
              role="switch"
              aria-checked={settings.autoplayLast}
              onClick={() => onChange({ ...settings, autoplayLast: !settings.autoplayLast })}
              className={choice(settings.autoplayLast)}
            >
              <span className="flex flex-1 flex-col">
                <span className="font-semibold">Запуск последнего канала</span>
                <span className="text-base text-muted-foreground">
                  {settings.autoplayLast ? 'Включено' : 'Выключено'}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-8 w-14 items-center rounded-full p-1 transition-colors',
                  settings.autoplayLast ? 'bg-primary' : 'bg-muted',
                )}
              >
                <span
                  className={cn(
                    'size-6 rounded-full bg-foreground transition-transform',
                    settings.autoplayLast && 'translate-x-6',
                  )}
                />
              </span>
            </button>
            <button type="button" data-nav onClick={onOpenPlaylist} className={choice(false)}>
              <span className="flex flex-1 flex-col">
                <span className="font-semibold">Сменить плейлист</span>
                <span className="truncate text-base text-muted-foreground">{playlistName ?? 'Не загружен'}</span>
              </span>
            </button>
          </div>
        </section>

        <section className={section} aria-labelledby="epg-heading">
          <h3 id="epg-heading" className={heading}>
            <Database aria-hidden="true" className="size-6 text-primary" />
            Телепрограмма (XMLTV)
          </h3>
          <label htmlFor="epg-url" className="text-lg text-muted-foreground">
            {playlistEpgUrl ? `Из плейлиста: ${playlistEpgUrl}` : 'В плейлисте нет ссылки на EPG'} — можно указать свою:
          </label>
          <div className="flex gap-4">
            <input
              id="epg-url"
              data-nav
              type="url"
              value={epgUrl}
              onChange={(e) => setEpgUrl(e.target.value)}
              onBlur={() => onChange({ ...settings, epgUrlOverride: epgUrl.trim() })}
              placeholder="https://example.com/epg.xml.gz"
              className="min-w-0 flex-1 rounded-2xl border border-input bg-background px-6 py-4 text-xl placeholder:text-muted-foreground"
            />
            <button
              type="button"
              data-nav
              disabled={epgStatus.loading}
              onClick={() => {
                onChange({ ...settings, epgUrlOverride: epgUrl.trim() })
                onRefreshEpg(epgUrl.trim())
              }}
              className="flex items-center gap-3 rounded-2xl bg-primary px-7 py-4 text-xl font-semibold text-primary-foreground disabled:opacity-60"
            >
              <RefreshCw aria-hidden="true" className={cn('size-6', epgStatus.loading && 'animate-spin')} />
              {epgStatus.loading ? `${epgStatus.progress}…` : 'Обновить'}
            </button>
          </div>
          <p className="text-base text-muted-foreground" aria-live="polite">
            {epgStatus.info}
          </p>
        </section>

        <section className={section} aria-labelledby="keys-heading">
          <div className="flex items-center justify-between gap-4">
            <h3 id="keys-heading" className={heading}>
              <Keyboard aria-hidden="true" className="size-6 text-primary" />
              Кнопки пульта
            </h3>
            <button
              type="button"
              data-nav
              onClick={() => onChange({ ...settings, keyMap: structuredClone(DEFAULT_KEYMAP) })}
              className="flex items-center gap-2 rounded-xl bg-secondary px-5 py-3 text-lg"
            >
              <RotateCcw aria-hidden="true" className="size-5" />
              Сбросить
            </button>
          </div>
          <p className="text-base text-muted-foreground">
            Выберите действие и нажмите новую кнопку на пульте. Кнопка будет удалена из других действий.
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {(Object.keys(ACTION_LABELS) as RemoteAction[]).map((action) => {
              const keys = settings.keyMap[action] ?? []
              const isCapturing = capturing === action
              return (
                <li key={action}>
                  <button
                    type="button"
                    data-nav
                    onClick={() => startCapture(action)}
                    className={cn(
                      'flex w-full items-center justify-between gap-4 rounded-2xl px-6 py-4 text-left text-lg',
                      isCapturing ? 'bg-primary text-primary-foreground' : 'bg-secondary',
                    )}
                  >
                    <span className="font-medium">{ACTION_LABELS[action]}</span>
                    <span className="flex flex-wrap justify-end gap-2">
                      {isCapturing ? (
                        <span className="font-semibold">Нажмите кнопку…</span>
                      ) : keys.length ? (
                        keys.map((k) => (
                          <kbd key={k} className="rounded-lg bg-background px-3 py-1 font-mono text-base text-foreground">
                            {keyLabel(k)}
                          </kbd>
                        ))
                      ) : (
                        <span className="text-destructive">Не назначено</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </TvDialog>
  )
}