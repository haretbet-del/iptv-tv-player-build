'use client'

import useSWR from 'swr'
import { getNowPlaying, getProgrammes } from '@/lib/iptv/db'
import type { Programme } from '@/lib/iptv/types'

const DAY = 86400000

export function useNowPlaying(keys: string[], epgVersion: number) {
  const joined = keys.join('|')
  const { data } = useSWR(
    keys.length ? ['now', epgVersion, joined] : null,
    () => getNowPlaying(keys),
    { refreshInterval: 60_000, keepPreviousData: true, revalidateOnFocus: false },
  )
  return data ?? ({} as Record<string, Programme>)
}

export function useProgrammes(channelKey: string | undefined, epgVersion: number, pastDays = 3) {
  const { data, isLoading } = useSWR(
    channelKey ? ['programmes', epgVersion, channelKey, pastDays] : null,
    () => {
      const now = Date.now()
      return getProgrammes(channelKey as string, now - pastDays * DAY, now + 2 * DAY)
    },
    { refreshInterval: 120_000, keepPreviousData: false, revalidateOnFocus: false },
  )
  return { programmes: data ?? [], isLoading }
}

export function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function formatDay(ms: number) {
  const d = new Date(ms)
  const today = new Date()
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      DAY,
  )
  if (diff === 0) return 'Сегодня'
  if (diff === -1) return 'Вчера'
  if (diff === 1) return 'Завтра'
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })
}

export function progressOf(p: Programme, now = Date.now()) {
  return Math.min(100, Math.max(0, ((now - p.start) / (p.stop - p.start)) * 100))
}
