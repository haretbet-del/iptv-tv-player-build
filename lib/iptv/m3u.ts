import type { CatchupMode, Channel, Playlist } from './types'

const ATTR_RE = /([\w-]+)=("([^"]*)"|'([^']*)'|([^\s,]+))/g

function parseAttrs(input: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const m of input.matchAll(ATTR_RE)) {
    attrs[m[1].toLowerCase()] = (m[3] ?? m[4] ?? m[5] ?? '').trim()
  }
  return attrs
}

export function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function toCatchupMode(value?: string): CatchupMode | undefined {
  if (!value) return undefined
  const v = value.toLowerCase()
  if (v === 'default' || v === 'append' || v === 'shift' || v === 'xc') return v
  if (v === 'flussonic' || v === 'flussonic-hls' || v === 'flussonic-ts' || v === 'fs') return 'flussonic'
  if (v === 'timeshift') return 'shift'
  return 'default'
}

/** Finds the first comma that is not inside a quoted attribute value. */
function splitTitle(line: string): [string, string] {
  let quote: string | null = null
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === ',') {
      return [line.slice(0, i), line.slice(i + 1).trim()]
    }
  }
  return [line, '']
}

export function parseM3U(text: string, meta: Pick<Playlist, 'name' | 'source' | 'url'>): Playlist {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const channels: Channel[] = []
  const groups: string[] = []
  const seenGroups = new Set<string>()
  const seenIds = new Map<string, number>()

  let headerAttrs: Record<string, string> = {}
  let pending: (Partial<Channel> & { name: string }) | null = null
  let pendingGroup: string | undefined

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (line.startsWith('#EXTM3U')) {
      headerAttrs = { ...headerAttrs, ...parseAttrs(line.slice(7)) }
      continue
    }

    if (line.startsWith('#EXTINF')) {
      const body = line.slice(line.indexOf(':') + 1)
      const [attrPart, title] = splitTitle(body)
      const a = parseAttrs(attrPart)
      const name = title || a['tvg-name'] || 'Без названия'
      const days = Number.parseInt(a['catchup-days'] ?? a['tvg-rec'] ?? a['timeshift'] ?? '', 10)
      pending = {
        name,
        logo: a['tvg-logo'] || a['logo'] || undefined,
        group: a['group-title'] || undefined,
        tvgId: a['tvg-id'] || undefined,
        tvgName: a['tvg-name'] || undefined,
        catchup: toCatchupMode(a['catchup'] ?? a['catchup-type']),
        catchupSource: a['catchup-source'] || undefined,
        catchupDays: Number.isFinite(days) && days > 0 ? days : undefined,
      }
      continue
    }

    if (line.startsWith('#EXTGRP:')) {
      pendingGroup = line.slice(8).trim()
      continue
    }

    if (line.startsWith('#')) continue

    if (pending) {
      const group = pending.group || pendingGroup || 'Без категории'
      if (!seenGroups.has(group)) {
        seenGroups.add(group)
        groups.push(group)
      }
      const baseId = line
      const count = seenIds.get(baseId) ?? 0
      seenIds.set(baseId, count + 1)
      const headerCatchup = toCatchupMode(headerAttrs['catchup'])
      const headerDays = Number.parseInt(headerAttrs['catchup-days'] ?? '', 10)

      channels.push({
        id: count === 0 ? baseId : `${baseId}#${count}`,
        name: pending.name,
        url: line,
        logo: pending.logo,
        group,
        tvgId: pending.tvgId,
        tvgName: pending.tvgName,
        epgKey: normalizeKey(pending.tvgId || pending.tvgName || pending.name),
        catchup: pending.catchup ?? headerCatchup,
        catchupSource: pending.catchupSource ?? headerAttrs['catchup-source'],
        catchupDays: pending.catchupDays ?? (Number.isFinite(headerDays) ? headerDays : undefined),
      })
      pending = null
      pendingGroup = undefined
    }
  }

  const epgUrl = (headerAttrs['url-tvg'] || headerAttrs['x-tvg-url'] || headerAttrs['tvg-url'] || '')
    .split(',')[0]
    ?.trim()

  return {
    ...meta,
    epgUrl: epgUrl || undefined,
    channels,
    groups,
    loadedAt: Date.now(),
  }
}
