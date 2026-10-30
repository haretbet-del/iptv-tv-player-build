'use client'

import { History, Radio } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { formatDay, formatTime, progressOf, useProgrammes } from '@/hooks/use-epg'
import { archiveDays, hasArchive } from '@/lib/iptv/catchup'
import type { Channel, Programme } from '@/lib/iptv/types'

interface EpgListProps {
  channel: Channel
  epgVersion: number
  playingArchiveId?: string
  onPlayLive: (channel: Channel) => void
  onPlayArchive: (channel: Channel, programme: Programme) => void
  onFuture: (programme: Programme) => void
  autofocusCurrent?: boolean
}

export function EpgList({
  channel,
  epgVersion,
  playingArchiveId,
  onPlayLive,
  onPlayArchive,
  onFuture,
  autofocusCurrent,
}: EpgListProps) {
  const { programmes, isLoading } = useProgrammes(channel.epgKey, epgVersion, archiveDays(channel))
  const listRef = useRef<HTMLUListElement>(null)
  const now = Date.now()
  const currentId = programmes.find((p) => p.start <= now && p.stop > now)?.id

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-current="true"]')
    if (el && listRef.current) {
      listRef.current.scrollTop = el.offsetTop - listRef.current.clientHeight / 3
    }
  }, [currentId, channel.id])

  if (isLoading) {
    return <p className="p-6 text-lg text-muted-foreground">Загрузка программы…</p>
  }

  if (!programmes.length) {
    return (
      <div className="flex flex-col gap-2 p-6">
        <p className="text-xl font-medium">Нет телепрограммы</p>
        <p className="text-base text-muted-foreground">
          Для этого канала EPG не найден. Проверьте tvg-id или ссылку на XMLTV в настройках.
        </p>
      </div>
    )
  }

  let lastDay = ''

  return (
    <ul ref={listRef} data-nav-group="epg" aria-label="Телепрограмма" className="tv-scroll relative h-full min-h-0 overflow-y-auto p-2">
      {programmes.map((p) => {
        const isLive = p.id === currentId
        const isPast = p.stop <= now
        const archive = isPast && hasArchive(channel, p, now)
        const day = formatDay(p.start)
        const showDay = day !== lastDay
        lastDay = day
        const playingThis = p.id === playingArchiveId

        return (
          <li key={p.id} data-current={isLive ? 'true' : undefined}>
            {showDay && (
              <p className="sticky top-0 z-[3] bg-background/95 px-4 pb-2 pt-4 text-base font-semibold uppercase tracking-wider text-muted-foreground">
                {day}
              </p>
            )}
            <button
              type="button"
              data-nav
              data-nav-id={`epg:${p.id}`}
              data-nav-autofocus={autofocusCurrent && isLive ? true : undefined}
              onClick={() => {
                if (isLive) onPlayLive(channel)
                else if (isPast) onPlayArchive(channel, p)
                else onFuture(p)
              }}
              className={cn(
                'mb-1.5 flex w-full items-start gap-4 rounded-xl px-4 py-3 text-left',
                isLive ? 'bg-primary/15' : playingThis ? 'bg-secondary' : 'hover:bg-secondary/60',
                !isPast && !isLive && 'opacity-70',
              )}
            >
              <span className={cn('w-16 shrink-0 pt-0.5 text-lg tabular-nums', isLive ? 'text-primary' : 'text-muted-foreground')}>
                {formatTime(p.start)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={cn('text-lg font-medium leading-snug', isPast && !archive && 'text-muted-foreground')}>
                  {p.title}
                </span>
                {isLive && (
                  <span className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <span className="block h-full bg-primary" style={{ width: `${progressOf(p, now)}%` }} />
                  </span>
                )}
              </span>
              {isLive && (
                <span className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-sm font-semibold text-primary-foreground">
                  <Radio aria-hidden="true" className="size-3.5" />
                  Эфир
                </span>
              )}
              {archive && (
                <span className="flex shrink-0 items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-sm font-medium text-foreground/80">
                  <History aria-hidden="true" className="size-3.5" />
                  Архив
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
