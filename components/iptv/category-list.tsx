'use client'

import { Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ALL_CHANNELS } from '@/lib/iptv/types'

interface CategoryListProps {
  groups: { name: string; count: number }[]
  totalCount: number
  selected: string
  onSelect: (group: string) => void
  onEnter: (group: string) => void
  navPrefix?: string
  compact?: boolean
}

export function CategoryList({
  groups,
  totalCount,
  selected,
  onSelect,
  onEnter,
  navPrefix = 'cat',
  compact,
}: CategoryListProps) {
  const items = [{ name: ALL_CHANNELS, count: totalCount }, ...groups]

  return (
    <nav aria-label="Категории" className="h-full min-h-0">
      <ul data-nav-group="categories" className="tv-scroll flex h-full flex-col gap-2 overflow-y-auto p-2">
        {items.map((g) => {
          const active = g.name === selected
          const label = g.name === ALL_CHANNELS ? 'Все каналы' : g.name
          return (
            <li key={g.name}>
              <button
                type="button"
                data-nav
                data-nav-id={`${navPrefix}:${g.name}`}
                data-nav-active={active ? 'true' : undefined}
                aria-current={active ? 'true' : undefined}
                onFocus={() => onSelect(g.name)}
                onClick={() => onEnter(g.name)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-xl text-left font-medium',
                  compact ? 'px-4 py-3 text-lg' : 'px-5 py-4 text-xl',
                  active ? 'bg-primary/15 text-primary' : 'text-foreground/85 hover:bg-secondary',
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  {g.name === ALL_CHANNELS && <Layers aria-hidden="true" className="size-[1.1em] shrink-0" />}
                  <span className="truncate">{label}</span>
                </span>
                <span className="shrink-0 rounded-md bg-background/60 px-2 py-0.5 text-base tabular-nums text-muted-foreground">
                  {g.count}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
