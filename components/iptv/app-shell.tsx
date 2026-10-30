'use client'

import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRemoteController, useRemoteHandler } from '@/hooks/use-remote'
import { clearProgrammes, getEpgMeta, purgeOldProgrammes, savePlaylist, loadPlaylist } from '@/lib/iptv/db'
import { importEpg } from '@/lib/iptv/epg'
import { DEFAULT_SETTINGS, loadLastChannel, loadSettings, saveLastChannel, saveSettings } from '@/lib/iptv/settings'
import { focusById, focusFirst } from '@/lib/iptv/spatial-nav'
import { ALL_CHANNELS, type Channel, type PlaybackTarget, type Playlist, type Settings } from '@/lib/iptv/types'
import { HomeView } from './home-view'
import { PlayerView } from './player-view'
import { PlaylistDialog } from './playlist-dialog'
import { SettingsDialog } from './settings-dialog'

const EPG_REFRESH_MS = 12 * 60 * 60 * 1000

type Dialog = 'playlist' | 'settings' | null

interface EpgStatus {
  loading: boolean
  progress: number
  info: string
}

const THEME_CLASSES: Record<Settings['themeMode'], string> = {
  cinema: 'theme-cinema bg-neutral-900 text-neutral-100',
  space: 'theme-space bg-slate-950 text-slate-100',
  cyberpunk: 'theme-cyberpunk bg-black text-neutral-100',
  light: 'theme-light bg-gray-100 text-gray-900',
}

const FOCUS_RING_CLASSES: Record<Settings['focusColor'], string> = {
  orange: 'focus-ring-orange',
  green: 'focus-ring-green',
  blue: 'focus-ring-blue',
  red: 'focus-ring-red',
}

export function AppShell() {
  const [booted, setBooted] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [category, setCategory] = useState(ALL_CHANNELS)
  const [focused, setFocused] = useState<Channel | null>(null)
  const [playback, setPlayback] = useState<{ target: PlaybackTarget; group: string } | null>(null)
  const [lastChannelId, setLastChannelId] = useState<string>()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [epgVersion, setEpgVersion] = useState(0)
  const [epgStatus, setEpgStatus] = useState<EpgStatus>({ loading: false, progress: 0, info: '' })
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const restoreFocusRef = useRef<string | null>(null)
  const epgAbortRef = useRef<AbortController | null>(null)

  useRemoteController(settings.keyMap)

  const notify = useCallback((message: string) => setToast({ id: Date.now(), message }), [])
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(t)
  }, [toast])

  const refreshEpg = useCallback(async (pl: Playlist, s: Settings, reset = false) => {
    const url = s.epgUrlOverride || pl.epgUrl
    if (!url) {
      setEpgStatus({ loading: false, progress: 0, info: 'Ссылка на EPG не задана' })
      return
    }
    epgAbortRef.current?.abort()
    const controller = new AbortController()
    epgAbortRef.current = controller
    setEpgStatus({ loading: true, progress: 0, info: 'Загрузка и разбор XMLTV…' })
    try {
      if (reset) await clearProgrammes()
      const result = await importEpg(
        url,
        pl.channels,
        (saved) => setEpgStatus((st) => ({ ...st, progress: saved })),
        controller.signal,
      )
      setEpgStatus({
        loading: false,
        progress: result.saved,
        info: `Сохранено ${result.saved} передач для каналов плейлиста · пропущено ${result.skipped} чужих · удалено устаревших ${result.purged}`,
      })
      setEpgVersion((v) => v + 1)
    } catch (e) {
      if (controller.signal.aborted) return
      setEpgStatus({
        loading: false,
        progress: 0,
        info: `Ошибка EPG: ${e instanceof Error ? e.message : 'неизвестная ошибка'}`,
      })
    }
  }, [])

  // Boot: settings, saved playlist, auto-resume of the last channel, EPG maintenance.
  useEffect(() => {
    const s = loadSettings()
    setSettings(s)
    let cancelled = false
    loadPlaylist()
      .then(async (pl) => {
        if (cancelled) return
        if (!pl) {
          setDialog('playlist')
          return
        }
        setPlaylist(pl)
        const last = loadLastChannel()
        const lastChannel = last && (pl.channels.find((c) => c.id === last.id) ?? pl.channels.find((c) => c.url === last.url))
        if (lastChannel) {
          setLastChannelId(lastChannel.id)
          setFocused(lastChannel)
          restoreFocusRef.current = `ch:${lastChannel.id}`
          if (s.autoplayLast) setPlayback({ target: { channel: lastChannel }, group: ALL_CHANNELS })
        }
        const url = s.epgUrlOverride || pl.epgUrl
        const meta = await getEpgMeta()
        if (url && (!meta || meta.url !== url || Date.now() - meta.updatedAt > EPG_REFRESH_MS)) {
          refreshEpg(pl, s, !!meta && meta.url !== url)
        } else {
          const purged = await purgeOldProgrammes()
          if (meta) {
            setEpgStatus({
              loading: false,
              progress: meta.count,
              info: `EPG обновлён ${new Date(meta.updatedAt).toLocaleString('ru-RU')} · ${meta.count} передач${purged ? ` · удалено устаревших ${purged}` : ''}`,
            })
          }
          setEpgVersion((v) => v + 1)
        }
      })
      .catch(() => setDialog('playlist'))
      .finally(() => !cancelled && setBooted(true))
    return () => {
      cancelled = true
    }
  }, [refreshEpg])

  // Restore D-Pad focus whenever the home screen becomes interactive again.
  useEffect(() => {
    if (!booted || dialog || playback || !playlist) return
    const raf = requestAnimationFrame(() => {
      const id = restoreFocusRef.current
      restoreFocusRef.current = null
      if (id && focusById(id)) return
      if (!focusById(`cat:${category}`)) focusFirst()
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on screen transitions
  }, [booted, dialog, playback, playlist])

  // Sync theme + focus color to <html> so overlays (portals, dialogs) inherit them too.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.themeMode
    root.dataset.focusColor = settings.focusColor
    root.classList.remove(
      'theme-cinema',
      'theme-space',
      'theme-cyberpunk',
      'theme-light',
      'focus-ring-orange',
      'focus-ring-green',
      'focus-ring-blue',
      'focus-ring-red',
    )
    root.classList.add(THEME_CLASSES[settings.themeMode])
    root.classList.add(FOCUS_RING_CLASSES[settings.focusColor])
  }, [settings.themeMode, settings.focusColor])

  const rememberFocus = () => {
    restoreFocusRef.current = (document.activeElement as HTMLElement | null)?.dataset?.navId ?? null
  }

  const openDialog = (d: Exclude<Dialog, null>) => {
    if (!dialog && !playback) rememberFocus()
    setDialog(d)
  }

  const play = useCallback((target: PlaybackTarget, group: string = ALL_CHANNELS) => {
    setPlayback({ target, group })
    setLastChannelId(target.channel.id)
    setFocused(target.channel)
    const { id, url, name, group: g } = target.channel
    saveLastChannel({ id, url, name, group: g })
  }, [])

  const exitPlayer = useCallback(() => {
    if (playback) restoreFocusRef.current = `ch:${playback.target.channel.id}`
    setPlayback(null)
  }, [playback])

  const updateSettings = (next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }

  const handlePlaylistLoaded = async (pl: Playlist) => {
    await savePlaylist(pl)
    await clearProgrammes()
    setPlaylist(pl)
    setCategory(ALL_CHANNELS)
    setFocused(null)
    setPlayback(null)
    restoreFocusRef.current = null
    setDialog(null)
    notify(`Загружено ${pl.channels.length} каналов`)
    refreshEpg(pl, settings)
  }

  useRemoteHandler(
    (action) => {
      if (action === 'menu' && !dialog) {
        openDialog('settings')
        return true
      }
      return false
    },
    50,
    booted && !!playlist,
  )

  const groups = useMemo(() => {
    if (!playlist) return []
    const counts = new Map<string, number>()
    for (const c of playlist.channels) counts.set(c.group, (counts.get(c.group) ?? 0) + 1)
    return playlist.groups.map((name) => ({ name, count: counts.get(name) ?? 0 }))
  }, [playlist])

  const themeClass = THEME_CLASSES[settings.themeMode]
  const focusClass = FOCUS_RING_CLASSES[settings.focusColor]

  if (!booted) {
    return (
      <div className={`flex h-dvh items-center justify-center ${themeClass} ${focusClass}`}>
        <Loader2 aria-label="Загрузка" className="size-14 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div
      className={`relative min-h-dvh ${themeClass} ${focusClass}`}
      data-theme={settings.themeMode}
      data-focus-color={settings.focusColor}
    >
      {playlist ? (
        <div inert={!!playback || !!dialog}>
          <HomeView
            playlist={playlist}
            category={category}
            onCategory={setCategory}
            focused={focused}
            onFocusChannel={setFocused}
            viewMode={settings.viewMode}
            epgVersion={epgVersion}
            epgLoading={epgStatus.loading}
            lastChannelId={lastChannelId}
            onPlay={play}
            onOpenSettings={() => openDialog('settings')}
            onOpenPlaylist={() => openDialog('playlist')}
            notify={notify}
          />
        </div>
      ) : (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 text-center">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-primary text-4xl font-black text-primary-foreground">
            U
          </div>
          <h1 className="text-4xl font-bold">Ultra IPTV Player</h1>
        </div>
      )}

      {playback && playlist && (
        <div inert={!!dialog}>
          <PlayerView
            target={playback.target}
            channels={playlist.channels}
            groups={groups}
            initialGroup={playback.group}
            epgVersion={epgVersion}
            onPlay={play}
            onExit={exitPlayer}
            notify={notify}
          />
        </div>
      )}

      {dialog === 'playlist' && (
        <PlaylistDialog
          closable={!!playlist}
          initialUrl={playlist?.url}
          onClose={() => setDialog(null)}
          onLoaded={handlePlaylistLoaded}
        />
      )}

      {dialog === 'settings' && (
        <SettingsDialog
          settings={settings}
          onChange={updateSettings}
          onClose={() => setDialog(null)}
          onOpenPlaylist={() => setDialog('playlist')}
          onRefreshEpg={(override) =>
            playlist &&
            refreshEpg(playlist, { ...settings, epgUrlOverride: override }, override !== settings.epgUrlOverride)
          }
          epgStatus={epgStatus}
          playlistName={playlist?.name}
          playlistEpgUrl={playlist?.epgUrl}
        />
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-10 z-[60] flex justify-center">
        {toast && (
          <p key={toast.id} className="rounded-2xl border border-border bg-popover px-8 py-4 text-xl shadow-2xl">
            {toast.message}
          </p>
        )}
      </div>
    </div>
  )
}