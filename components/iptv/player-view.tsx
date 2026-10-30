'use client'

import Hls from 'hls.js'
import { AlertTriangle, ChevronLeft, ChevronRight, History, Loader2, Radio, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatTime, progressOf, useNowPlaying, useProgrammes } from '@/hooks/use-epg'
import { useRemoteHandler } from '@/hooks/use-remote'
import { buildCatchupUrl } from '@/lib/iptv/catchup'
import { focusFirst, moveFocus } from '@/lib/iptv/spatial-nav'
import { ALL_CHANNELS, type Channel, type PlaybackTarget, type Programme } from '@/lib/iptv/types'
import { CategoryList } from './category-list'
import { ChannelList } from './channel-list'
import { ChannelLogo } from './channel-logo'
import { EpgList } from './epg-list'

type Panel = 'none' | 'channels' | 'epg'

interface PlayerViewProps {
  target: PlaybackTarget
  channels: Channel[]
  groups: { name: string; count: number }[]
  initialGroup: string
  epgVersion: number
  onPlay: (target: PlaybackTarget, group?: string) => void
  onExit: () => void
  notify: (message: string) => void
}

const PANEL_IDLE_MS = 15000
const OSD_MS = 5000

export function PlayerView({ target, channels, groups, initialGroup, epgVersion, onPlay, onExit, notify }: PlayerViewProps) {
  const { channel, archive } = target
  const videoRef = useRef<HTMLVideoElement>(null)
  const channelsPanelRef = useRef<HTMLDivElement>(null)
  const epgPanelRef = useRef<HTMLDivElement>(null)
  const [panel, setPanel] = useState<Panel>('none')
  const [osdVisible, setOsdVisible] = useState(true)
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading')
  const [errorText, setErrorText] = useState('')
  const [muted, setMuted] = useState(false)
  const [panelGroup, setPanelGroup] = useState(initialGroup)
  const [playGroup, setPlayGroup] = useState(initialGroup)

  const url = useMemo(() => (archive ? buildCatchupUrl(channel, archive) : channel.url), [channel, archive])

  const groupChannels = useCallback(
    (g: string) => (g === ALL_CHANNELS ? channels : channels.filter((c) => c.group === g)),
    [channels],
  )
  const zapList = useMemo(() => {
    const list = groupChannels(playGroup)
    return list.some((c) => c.id === channel.id) ? list : channels
  }, [groupChannels, playGroup, channels, channel.id])
  const panelChannels = useMemo(() => groupChannels(panelGroup), [groupChannels, panelGroup])

  const nowMap = useNowPlaying(
    useMemo(() => panelChannels.slice(0, 300).map((c) => c.epgKey), [panelChannels]),
    epgVersion,
  )
  const { programmes } = useProgrammes(channel.epgKey, epgVersion, 0)
  const now = Date.now()
  const current = archive ?? programmes.find((p) => p.start <= now && p.stop > now)
  const next = archive ? undefined : programmes.find((p) => p.start >= (current?.stop ?? now))

  // Player engine: hls.js with native fallback (Android TV WebView / Safari).
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    setStatus('loading')
    setErrorText('')
    let hls: Hls | null = null
    let fellBack = false

    const tryPlay = () => {
      video.play().catch(() => {
        video.muted = true
        setMuted(true)
        video.play().catch(() => undefined)
      })
    }

    const fallbackToNative = () => {
      fellBack = true
      hls?.destroy()
      hls = null
      video.src = url
      tryPlay()
    }

    const isProgressive = /\.(mp4|webm|mkv|mov)(\?|$)/i.test(url)
    if (!isProgressive && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, backBufferLength: 30, maxBufferLength: 30 })
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError()
        else if (!fellBack) fallbackToNative()
      })
      hls.on(Hls.Events.MANIFEST_PARSED, tryPlay)
      hls.loadSource(url)
      hls.attachMedia(video)
    } else {
      video.src = url
      tryPlay()
    }

    const onPlaying = () => setStatus('playing')
    const onWaiting = () => setStatus((s) => (s === 'error' ? s : 'loading'))
    const onError = () => {
      if (hls && !fellBack) return
      setStatus('error')
      setErrorText(archive ? 'Архив недоступен для этой передачи' : 'Не удалось открыть поток канала')
    }
    video.addEventListener('playing', onPlaying)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('error', onError)

    return () => {
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('error', onError)
      hls?.destroy()
      video.removeAttribute('src')
      video.load()
    }
  }, [url, archive])

  // OSD auto-hide on every channel change / interaction.
  const [osdTick, setOsdTick] = useState(0)
  const showOsd = useCallback(() => {
    setOsdVisible(true)
    setOsdTick((t) => t + 1)
  }, [])
  useEffect(() => {
    showOsd()
  }, [url, showOsd])
  useEffect(() => {
    if (!osdVisible || panel !== 'none') return
    const t = window.setTimeout(() => setOsdVisible(false), OSD_MS)
    return () => window.clearTimeout(t)
  }, [osdVisible, osdTick, panel])

  // Side panels: focus on open, auto-close after inactivity.
  const [panelTick, setPanelTick] = useState(0)
  useEffect(() => {
    if (panel === 'none') {
      ;(document.activeElement as HTMLElement | null)?.blur?.()
      return
    }
    const ref = panel === 'channels' ? channelsPanelRef : epgPanelRef
    const raf = requestAnimationFrame(() => {
      if (ref.current) focusFirst(ref.current)
    })
    return () => cancelAnimationFrame(raf)
  }, [panel])
  useEffect(() => {
    if (panel === 'none') return
    const t = window.setTimeout(() => setPanel('none'), PANEL_IDLE_MS)
    return () => window.clearTimeout(t)
  }, [panel, panelTick])

  const zap = useCallback(
    (delta: number) => {
      const i = zapList.findIndex((c) => c.id === channel.id)
      const nextChannel = zapList[(i + delta + zapList.length) % zapList.length]
      if (nextChannel) onPlay({ channel: nextChannel }, playGroup)
    },
    [zapList, channel.id, onPlay, playGroup],
  )

  const openPanel = (p: Panel) => {
    if (p === 'channels') setPanelGroup(playGroup)
    setPanel(p)
    setOsdVisible(false)
  }

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return
    if (video.muted) {
      video.muted = false
      setMuted(false)
      return
    }
    if (archive) {
      if (video.paused) video.play().catch(() => undefined)
      else video.pause()
    }
  }

  useRemoteHandler(
    (action) => {
      if (panel !== 'none') {
        setPanelTick((t) => t + 1)
        if (action === 'back') {
          setPanel('none')
          return true
        }
        if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
          const moved = moveFocus(action)
          if (!moved && panel === 'channels' && action === 'right') setPanel('none')
          if (!moved && panel === 'epg' && action === 'left') setPanel('none')
          return true
        }
        return false
      }
      switch (action) {
        case 'left':
          openPanel('channels')
          return true
        case 'right':
          openPanel('epg')
          return true
        case 'up':
        case 'chUp':
          zap(-1)
          return true
        case 'down':
        case 'chDown':
          zap(1)
          return true
        case 'ok':
          togglePlayback()
          showOsd()
          return true
        case 'info':
          if (osdVisible) setOsdVisible(false)
          else showOsd()
          return true
        case 'back':
          onExit()
          return true
        default:
          return false
      }
    },
    10,
  )

  const playFromPanel = (c: Channel) => {
    setPlayGroup(panelGroup)
    onPlay({ channel: c }, panelGroup)
    setPanel('none')
  }

  return (
    <div className="fixed inset-0 z-40 bg-black" role="region" aria-label={`Просмотр: ${channel.name}`}>
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        autoPlay
        controls={false}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
      />

      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 aria-label="Загрузка" className="size-16 animate-spin text-primary" />
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 p-10 text-center">
          <AlertTriangle aria-hidden="true" className="size-16 text-primary" />
          <p className="text-3xl font-semibold">{errorText}</p>
          <p className="max-w-2xl text-xl text-muted-foreground">
            {'↑ / ↓ — другой канал, ← — список каналов, Назад — выход'}
          </p>
        </div>
      )}

      {muted && status === 'playing' && (
        <div className="absolute right-8 top-8 flex items-center gap-3 rounded-xl bg-background/80 px-5 py-3 text-lg backdrop-blur">
          <VolumeX aria-hidden="true" className="size-6 text-primary" />
          Звук выключен — нажмите ОК
        </div>
      )}

      {/* Bottom OSD */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-12 pb-10 pt-32 transition-all duration-300',
          osdVisible && panel === 'none' ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
        )}
        aria-hidden={!osdVisible}
      >
        <div className="flex items-end gap-8">
          <ChannelLogo src={channel.logo} name={channel.name} className="size-32 rounded-2xl bg-card" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-4">
              <span className="text-lg tabular-nums text-muted-foreground">
                {zapList.findIndex((c) => c.id === channel.id) + 1}
              </span>
              <h2 className="truncate text-4xl font-bold">{channel.name}</h2>
              {archive ? (
                <span className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1 text-lg font-medium">
                  <History aria-hidden="true" className="size-5" />
                  Архив
                </span>
              ) : (
                <span className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1 text-lg font-semibold text-primary-foreground">
                  <Radio aria-hidden="true" className="size-5" />
                  Эфир
                </span>
              )}
            </div>
            {current ? (
              <ProgrammeLine p={current} live={!archive} />
            ) : (
              <p className="text-xl text-muted-foreground">Нет данных телепрограммы</p>
            )}
            {next && (
              <p className="truncate text-lg text-muted-foreground">
                {'Далее '}
                {formatTime(next.start)} — {next.title}
              </p>
            )}
          </div>
          <div className="hidden shrink-0 flex-col items-end gap-2 text-lg text-muted-foreground lg:flex">
            <span className="flex items-center gap-2">
              <ChevronLeft aria-hidden="true" className="size-5" /> Каналы
            </span>
            <span className="flex items-center gap-2">
              Программа <ChevronRight aria-hidden="true" className="size-5" />
            </span>
          </div>
        </div>
      </div>

      {/* Left slide-in: categories + channels */}
      <div
        ref={channelsPanelRef}
        data-nav-scope="20"
        inert={panel !== 'channels'}
        aria-hidden={panel !== 'channels'}
        className={cn(
          'absolute inset-y-0 left-0 flex w-[min(60rem,90vw)] bg-background/90 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out',
          panel === 'channels' ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex w-[38%] flex-col border-r border-border">
          <p className="px-6 pb-2 pt-8 text-base font-semibold uppercase tracking-wider text-muted-foreground">Категории</p>
          <div className="min-h-0 flex-1">
            <CategoryList
              groups={groups}
              totalCount={channels.length}
              selected={panelGroup}
              onSelect={setPanelGroup}
              onEnter={() => moveFocus('right')}
              navPrefix="pcat"
              compact
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="px-6 pb-2 pt-8 text-base font-semibold uppercase tracking-wider text-muted-foreground">
            Каналы · {panelChannels.length}
          </p>
          <div className="min-h-0 flex-1">
            <ChannelList
              channels={panelChannels}
              viewMode="compact"
              nowPlaying={nowMap}
              playingId={channel.id}
              autofocusId={channel.id}
              onFocusChannel={() => undefined}
              onOpen={playFromPanel}
              navPrefix="pch"
              dense
            />
          </div>
        </div>
      </div>

      {/* Right slide-in: programme guide with catch-up */}
      <div
        ref={epgPanelRef}
        data-nav-scope="20"
        inert={panel !== 'epg'}
        aria-hidden={panel !== 'epg'}
        className={cn(
          'absolute inset-y-0 right-0 flex w-[min(40rem,85vw)] flex-col bg-background/90 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out',
          panel === 'epg' ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center gap-4 px-6 pb-4 pt-8">
          <ChannelLogo src={channel.logo} name={channel.name} className="size-14" />
          <div className="min-w-0">
            <p className="truncate text-2xl font-semibold">{channel.name}</p>
            <p className="text-base text-muted-foreground">Телепрограмма и архив</p>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          {panel === 'epg' && (
            <EpgList
              channel={channel}
              epgVersion={epgVersion}
              playingArchiveId={archive?.id}
              autofocusCurrent
              onPlayLive={(c) => {
                onPlay({ channel: c }, playGroup)
                setPanel('none')
              }}
              onPlayArchive={(c, p) => {
                onPlay({ channel: c, archive: p }, playGroup)
                setPanel('none')
              }}
              onFuture={(p: Programme) => notify(`«${p.title}» начнётся в ${formatTime(p.start)}`)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ProgrammeLine({ p, live }: { p: Programme; live: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="truncate text-2xl font-medium">
        <span className="tabular-nums text-muted-foreground">
          {formatTime(p.start)} – {formatTime(p.stop)}
        </span>{' '}
        {p.title}
      </p>
      {live && (
        <span className="h-1.5 w-full max-w-3xl overflow-hidden rounded-full bg-secondary">
          <span className="block h-full bg-primary" style={{ width: `${progressOf(p)}%` }} />
        </span>
      )}
    </div>
  )
}
