'use client'

import { ListVideo, Loader2, Settings as SettingsIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { formatTime, useNowPlaying } from '@/hooks/use-epg'
import { useRemoteHandler } from '@/hooks/use-remote'
import { focusById, focusFirst } from '@/lib/iptv/spatial-nav'
import { ALL_CHANNELS, type Channel, type PlaybackTarget, type Playlist, type ViewMode } from '@/lib/iptv/types'
import { CategoryList } from './category-list'
import { ChannelList } from './channel-list'
import { ChannelLogo } from './channel-logo'
import { EpgList } from './epg-list'

interface HomeViewProps {
  playlist: Playlist
  category: string
  onCategory: (group: string) => void
  focused: Channel | null
  onFocusChannel: (channel: Channel) => void
  viewMode: ViewMode
  epgVersion: number
  epgLoading: boolean
  lastChannelId?: string
  onPlay: (target: PlaybackTarget, group: string) => void
  onOpenSettings: () => void
  onOpenPlaylist: () => void
  notify: (message: string) => void
}

export function HomeView({
  playlist,
  category,
  onCategory,
  focused,
  onFocusChannel,
  viewMode,
  epgVersion,
  epgLoading,
  lastChannelId,
  onPlay,
  onOpenSettings,
  onOpenPlaylist,
  notify,
}: HomeViewProps) {
  const groups = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of playlist.channels) counts.set(c.group, (counts.get(c.group) ?? 0) + 1)
    return playlist.groups.map((name) => ({ name, count: counts.get(name) ?? 0 }))
  }, [playlist])

  const channels = useMemo(
    () => (category === ALL_CHANNELS ? playlist.channels : playlist.channels.filter((c) => c.group === category)),
    [playlist, category],
  )

  const nowMap = useNowPlaying(
    useMemo(() => channels.slice(0, 300).map((c) => c.epgKey), [channels]),
    epgVersion,
  )

  const preview = focused ?? channels[0] ?? null
  const previewNow = preview ? nowMap[preview.epgKey] : undefined

  useRemoteHandler((action) => {
    if (action === 'back') {
      const inCategories = document.activeElement?.closest('[data-nav-group="categories"]')
      if (!inCategories) {
        focusById(`cat:${category}`)
        return true
      }
    }
    return false
  }, 0)

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-6 px-10 pb-4 pt-7">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-xl font-black text-primary-foreground">
            U
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ultra IPTV</h1>
            <p className="text-base text-muted-foreground">
              {playlist.name} · {playlist.channels.length} каналов
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {epgLoading && (
            <span className="flex items-center gap-2 text-base text-muted-foreground">
              <Loader2 aria-hidden="true" className="size-5 animate-spin text-primary" />
              Загрузка EPG
            </span>
          )}
          <Clock />
          <button
            type="button"
            data-nav
            data-nav-id="top:playlist"
            onClick={onOpenPlaylist}
            className="flex items-center gap-3 rounded-xl bg-secondary px-5 py-3 text-lg font-medium"
          >
            <ListVideo aria-hidden="true" className="size-6" />
            Плейлист
          </button>
          <button
            type="button"
            data-nav
            data-nav-id="top:settings"
            onClick={onOpenSettings}
            className="flex items-center gap-3 rounded-xl bg-secondary px-5 py-3 text-lg font-medium"
          >
            <SettingsIcon aria-hidden="true" className="size-6" />
            Настройки
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(14rem,18%)_1fr_minmax(22rem,30%)] gap-4 px-6 pb-6">
        <section aria-label="Категории" className="flex min-h-0 flex-col rounded-3xl bg-card/50">
          <h2 className="px-6 pb-1 pt-5 text-base font-semibold uppercase tracking-wider text-muted-foreground">
            Категории
          </h2>
          <div className="min-h-0 flex-1">
            <CategoryList
              groups={groups}
              totalCount={playlist.channels.length}
              selected={category}
              onSelect={onCategory}
              onEnter={() => {
                const list = document.querySelector<HTMLElement>('[data-nav-group="channels"]')
                if (list) focusFirst(list)
              }}
            />
          </div>
        </section>

        <section aria-label="Каналы" className="flex min-h-0 flex-col rounded-3xl bg-card/30">
          <h2 className="px-6 pb-1 pt-5 text-base font-semibold uppercase tracking-wider text-muted-foreground">
            {category === ALL_CHANNELS ? 'Все каналы' : category} · {channels.length}
          </h2>
          <div className="min-h-0 flex-1">
            <ChannelList
              channels={channels}
              viewMode={viewMode}
              nowPlaying={nowMap}
              playingId={lastChannelId}
              onFocusChannel={onFocusChannel}
              onOpen={(c) => onPlay({ channel: c }, category)}
            />
          </div>
        </section>

        <section aria-label="Телепрограмма" className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-card/50">
          {preview ? (
            <>
              <div className="flex items-center gap-5 border-b border-border px-6 py-5">
                <ChannelLogo src={preview.logo} name={preview.name} className="size-20 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-2xl font-bold">{preview.name}</p>
                  {previewNow ? (
                    <p className="truncate text-lg text-muted-foreground">
                      <span className="tabular-nums text-primary">{formatTime(previewNow.start)}</span> {previewNow.title}
                    </p>
                  ) : (
                    <p className="text-lg text-muted-foreground">{preview.group}</p>
                  )}
                </div>
              </div>
              {previewNow?.desc && (
                <p className="line-clamp-3 border-b border-border px-6 py-4 text-base leading-relaxed text-muted-foreground">
                  {previewNow.desc}
                </p>
              )}
              <div className="min-h-0 flex-1">
                <EpgList
                  key={preview.id}
                  channel={preview}
                  epgVersion={epgVersion}
                  onPlayLive={(c) => onPlay({ channel: c }, category)}
                  onPlayArchive={(c, p) => onPlay({ channel: c, archive: p }, category)}
                  onFuture={(p) => notify(`«${p.title}» начнётся в ${formatTime(p.start)}`)}
                />
              </div>
            </>
          ) : (
            <p className="p-6 text-lg text-muted-foreground">Выберите канал</p>
          )}
        </section>
      </main>
    </div>
  )
}

function Clock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(t)
  }, [])
  return (
    <time className="px-2 text-3xl font-semibold tabular-nums" dateTime={new Date(now).toISOString()}>
      {formatTime(now)}
    </time>
  )
}
