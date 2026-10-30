'use client'

import { Play } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { progressOf } from '@/hooks/use-epg'
import type { Channel, Programme, ViewMode } from '@/lib/iptv/types'
import { ChannelLogo } from './channel-logo'

const PAGE = 150

interface ChannelListProps {
  channels: Channel[]
  viewMode: ViewMode
  nowPlaying: Record<string, Programme>
  playingId?: string
  onFocusChannel: (channel: Channel) => void
  onOpen: (channel: Channel) => void
  navPrefix?: string
  dense?: boolean
  autofocusId?: string
}

export function ChannelList({
  channels,
  viewMode,
  nowPlaying,
  playingId,
  onFocusChannel,
  onOpen,
  navPrefix = 'ch',
  dense,
  autofocusId,
}: ChannelListProps) {
  const [limit, setLimit] = useState(PAGE)
  const [listKey, setListKey] = useState(channels)
  if (listKey !== channels) {
    setListKey(channels)
    setLimit(Math.max(PAGE, channels.findIndex((c) => c.id === autofocusId) + 20))
  }

  if (!channels.length) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-xl text-muted-foreground">
        В этой категории нет каналов
      </div>
    )
  }

  const visible = channels.slice(0, limit)
  const handleFocus = (channel: Channel, index: number) => {
    onFocusChannel(channel)
    if (index > limit - 20 && limit < channels.length) setLimit((l) => l + PAGE)
  }

  const grid = viewMode === 'grid'

  return (
    <ul
      data-nav-group="channels"
      aria-label="Каналы"
      className={cn(
        'tv-scroll h-full min-h-0 overflow-y-auto p-3',
        grid
          ? dense
            ? 'grid auto-rows-min grid-cols-2 gap-4'
            : 'grid auto-rows-min grid-cols-2 gap-5 lg:grid-cols-3 2xl:grid-cols-4'
          : 'flex flex-col gap-2',
      )}
    >
      {visible.map((channel, index) => {
        const now = nowPlaying[channel.epgKey]
        const playing = channel.id === playingId
        const common = {
          type: 'button' as const,
          'data-nav': true,
          'data-nav-id': `${navPrefix}:${channel.id}`,
          'data-nav-active': playing ? 'true' : undefined,
          'data-nav-autofocus': channel.id === autofocusId ? true : undefined,
          onFocus: () => handleFocus(channel, index),
          onClick: () => onOpen(channel),
          'aria-label': `${index + 1}. ${channel.name}${now ? `, сейчас: ${now.title}` : ''}`,
        }

        if (grid) {
          return (
            <li key={channel.id}>
              <button
                {...common}
                data-nav-scale
                className={cn(
                  'group flex w-full flex-col overflow-hidden rounded-2xl bg-card text-left',
                  playing && 'ring-2 ring-primary/60',
                )}
              >
                <div className="relative flex aspect-video w-full items-center justify-center bg-secondary/60">
                  <ChannelLogo src={channel.logo} name={channel.name} className="h-[78%] aspect-square bg-transparent" />
                  <span className="absolute left-3 top-3 rounded-md bg-background/80 px-2 py-0.5 text-sm tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  {playing && (
                    <span className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-sm font-semibold text-primary-foreground">
                      <Play aria-hidden="true" className="size-3.5 fill-current" />
                      Эфир
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1 px-4 py-3">
                  <span className="truncate text-xl font-semibold">{channel.name}</span>
                  <span className="truncate text-base text-muted-foreground">{now?.title ?? channel.group}</span>
                  {now && (
                    <span className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
                      <span className="block h-full bg-primary" style={{ width: `${progressOf(now)}%` }} />
                    </span>
                  )}
                </div>
              </button>
            </li>
          )
        }

        return (
          <li key={channel.id}>
            <button
              {...common}
              className={cn(
                'flex w-full items-center gap-4 rounded-xl px-5 text-left',
                dense ? 'py-3' : 'py-4',
                playing ? 'bg-primary/15' : 'bg-card/70 hover:bg-card',
              )}
            >
              <span className="w-10 shrink-0 text-right text-lg tabular-nums text-muted-foreground">{index + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn('truncate font-semibold', dense ? 'text-lg' : 'text-xl', playing && 'text-primary')}>
                  {channel.name}
                </span>
                {now && <span className="truncate text-base text-muted-foreground">{now.title}</span>}
              </span>
              {playing && <Play aria-hidden="true" className="size-5 shrink-0 fill-primary text-primary" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
