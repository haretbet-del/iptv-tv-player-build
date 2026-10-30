import type { Channel, Programme } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

function fillTemplate(template: string, p: Programme, now: number): string {
  const start = Math.floor(p.start / 1000)
  const end = Math.floor(p.stop / 1000)
  const lutc = Math.floor(now / 1000)
  const duration = end - start
  const d = new Date(p.start)
  const e = new Date(p.stop)

  const map: Record<string, string> = {
    utc: String(start),
    start: String(start),
    timestamp: String(start),
    utcend: String(end),
    end: String(end),
    lutc: String(lutc),
    now: String(lutc),
    duration: String(duration),
    offset: String(lutc - start),
    Y: String(d.getUTCFullYear()),
    m: pad(d.getUTCMonth() + 1),
    d: pad(d.getUTCDate()),
    H: pad(d.getUTCHours()),
    M: pad(d.getUTCMinutes()),
    S: pad(d.getUTCSeconds()),
    'end-Y': String(e.getUTCFullYear()),
    'end-m': pad(e.getUTCMonth() + 1),
    'end-d': pad(e.getUTCDate()),
    'end-H': pad(e.getUTCHours()),
    'end-M': pad(e.getUTCMinutes()),
    'end-S': pad(e.getUTCSeconds()),
  }

  return template
    .replace(/\$?\{duration:(\d+)\}/g, (_, div) => String(Math.floor(duration / Number(div))))
    .replace(/\$?\{offset:(\d+)\}/g, (_, div) => String(Math.floor((lutc - start) / Number(div))))
    .replace(/\$?\{\(b\)yyyy\}/g, map.Y)
    .replace(/\$?\{\(b\)MM\}/g, map.m)
    .replace(/\$?\{\(b\)dd\}/g, map.d)
    .replace(/\$?\{\(b\)HH\}/g, map.H)
    .replace(/\$?\{\(b\)mm\}/g, map.M)
    .replace(/\$?\{\(b\)ss\}/g, map.S)
    .replace(/\$?\{([\w-]+)\}/g, (full, key: string) => map[key] ?? full)
}

const joinQuery = (url: string, query: string) => `${url}${url.includes('?') ? '&' : '?'}${query}`

/** Builds an archive (catch-up) URL for a past programme. */
export function buildCatchupUrl(channel: Channel, p: Programme, now = Date.now()): string {
  const mode = channel.catchup ?? 'shift'
  const source = channel.catchupSource

  switch (mode) {
    case 'append':
      return channel.url + fillTemplate(source ?? '?utc={utc}&lutc={lutc}', p, now)
    case 'default':
      if (source) return fillTemplate(source, p, now)
      return joinQuery(channel.url, fillTemplate('utc={utc}&lutc={lutc}', p, now))
    case 'flussonic': {
      const start = Math.floor(p.start / 1000)
      const duration = Math.floor((p.stop - p.start) / 1000)
      if (/\/(index|video|mono)\.m3u8/.test(channel.url)) {
        return channel.url.replace(/\/(index|video|mono)\.m3u8/, `/$1-${start}-${duration}.m3u8`)
      }
      if (/\/mpegts/.test(channel.url)) {
        return channel.url.replace(/\/mpegts.*$/, `/timeshift_abs-${start}.ts`)
      }
      return joinQuery(channel.url, `utc=${start}&lutc=${Math.floor(now / 1000)}`)
    }
    case 'xc': {
      const m = channel.url.match(/^(https?:\/\/[^/]+)\/(?:live\/)?([^/]+)\/([^/]+)\/(\d+)(\.\w+)?$/)
      if (m) {
        const d = new Date(p.start)
        const stamp = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}:${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}`
        const minutes = Math.ceil((p.stop - p.start) / 60000)
        return `${m[1]}/timeshift/${m[2]}/${m[3]}/${minutes}/${stamp}/${m[4]}${m[5] ?? '.ts'}`
      }
      return joinQuery(channel.url, fillTemplate('utc={utc}&lutc={lutc}', p, now))
    }
    default:
      return joinQuery(channel.url, fillTemplate('utc={utc}&lutc={lutc}', p, now))
  }
}

export function archiveDays(channel: Channel): number {
  return channel.catchupDays ?? 3
}

export function hasArchive(channel: Channel, p: Programme, now = Date.now()): boolean {
  return p.stop <= now && p.start >= now - archiveDays(channel) * 86400000
}
