import { EPG_RETENTION_MS, purgeOldProgrammes, putProgrammes, setEpgMeta } from './db'
import { normalizeKey } from './m3u'
import type { Channel, Programme } from './types'

const BATCH_SIZE = 500
const FUTURE_LIMIT_MS = 8 * 24 * 60 * 60 * 1000

export function proxied(url: string): string {
  if (url.startsWith('/')) return url
  return `/api/proxy?url=${encodeURIComponent(url)}`
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(Number.parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .trim()
}

/** Parses XMLTV timestamps like "20261030193000 +0300". */
export function parseXmltvDate(value: string): number {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/)
  if (!m) return Number.NaN
  const [, y, mo, d, h, mi, s = '00', tz] = m
  let ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)
  if (tz) {
    const sign = tz[0] === '-' ? -1 : 1
    const offset = (+tz.slice(1, 3) * 60 + +tz.slice(3, 5)) * 60000
    ms -= sign * offset
  }
  return ms
}

function readAttr(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`))
  return m ? (m[1] ?? m[2]) : undefined
}

async function toTextStream(body: ReadableStream<Uint8Array>): Promise<ReadableStream<string>> {
  const reader = body.getReader()
  const first = await reader.read()
  const head = first.value
  const isGzip = !!head && head.length > 1 && head[0] === 0x1f && head[1] === 0x8b

  const replay = new ReadableStream<Uint8Array>({
    start(controller) {
      if (head) controller.enqueue(head)
      if (first.done) controller.close()
    },
    async pull(controller) {
      const { value, done } = await reader.read()
      if (done) controller.close()
      else controller.enqueue(value)
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })

  const bytes = isGzip
    ? replay.pipeThrough(new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>)
    : replay
  return bytes.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>)
}

export interface EpgImportResult {
  saved: number
  skipped: number
  purged: number
}

/**
 * Streams an XMLTV file and stores ONLY programmes of channels present in the playlist.
 * The XML is never fully held in memory: it is processed chunk by chunk and written in batches.
 */
export async function importEpg(
  url: string,
  channels: Channel[],
  onProgress?: (saved: number) => void,
  signal?: AbortSignal,
): Promise<EpgImportResult> {
  const wanted = new Set(channels.map((c) => c.epgKey))
  const byName = new Map<string, string>()
  for (const c of channels) {
    byName.set(normalizeKey(c.tvgName || c.name), c.epgKey)
    byName.set(normalizeKey(c.name), c.epgKey)
  }
  const alias = new Map<string, string>()

  const res = await fetch(proxied(url), { signal })
  if (!res.ok || !res.body) throw new Error(`EPG: HTTP ${res.status}`)
  const reader = (await toTextStream(res.body)).getReader()

  const now = Date.now()
  const minStop = now - EPG_RETENTION_MS
  const maxStart = now + FUTURE_LIMIT_MS
  const channelRe = /<channel\s+([^>]*)>([\s\S]*?)<\/channel>/g
  const displayRe = /<display-name[^>]*>([\s\S]*?)<\/display-name>/g
  const programmeRe = /<programme\s+([^>]*)>([\s\S]*?)<\/programme>/g
  const titleRe = /<title[^>]*>([\s\S]*?)<\/title>/
  const descRe = /<desc[^>]*>([\s\S]*?)<\/desc>/

  let buffer = ''
  let batch: Programme[] = []
  let saved = 0
  let skipped = 0

  const resolveKey = (xmlId: string): string | undefined => {
    const k = normalizeKey(xmlId)
    if (wanted.has(k)) return k
    return alias.get(k)
  }

  const processChunk = async (text: string) => {
    for (const m of text.matchAll(channelRe)) {
      const id = readAttr(m[1], 'id')
      if (!id) continue
      const k = normalizeKey(id)
      if (wanted.has(k) || alias.has(k)) continue
      for (const d of m[2].matchAll(displayRe)) {
        const match = byName.get(normalizeKey(decodeXml(d[1])))
        if (match) {
          alias.set(k, match)
          break
        }
      }
    }

    for (const m of text.matchAll(programmeRe)) {
      const attrs = m[1]
      const chId = readAttr(attrs, 'channel')
      const key = chId ? resolveKey(chId) : undefined
      if (!key) {
        skipped++
        continue
      }
      const start = parseXmltvDate(readAttr(attrs, 'start') ?? '')
      const stop = parseXmltvDate(readAttr(attrs, 'stop') ?? '')
      if (!Number.isFinite(start) || !Number.isFinite(stop) || stop < minStop || start > maxStart) {
        skipped++
        continue
      }
      const title = m[2].match(titleRe)
      const desc = m[2].match(descRe)
      batch.push({
        id: `${key}|${start}`,
        channel: key,
        start,
        stop,
        title: title ? decodeXml(title[1]) : 'Без названия',
        desc: desc ? decodeXml(desc[1]).slice(0, 600) : undefined,
      })
      if (batch.length >= BATCH_SIZE) {
        const items = batch
        batch = []
        await putProgrammes(items)
        saved += items.length
        onProgress?.(saved)
      }
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (value) buffer += value
    const cut = Math.max(buffer.lastIndexOf('</programme>') + 12, buffer.lastIndexOf('</channel>') + 10)
    if (cut > 11) {
      await processChunk(buffer.slice(0, cut))
      buffer = buffer.slice(cut)
    } else if (buffer.length > 4_000_000) {
      buffer = buffer.slice(-200_000)
    }
    if (done) break
  }

  if (buffer) await processChunk(buffer)
  if (batch.length) {
    await putProgrammes(batch)
    saved += batch.length
    onProgress?.(saved)
  }

  const purged = await purgeOldProgrammes()
  await setEpgMeta({ url, updatedAt: Date.now(), count: saved })
  return { saved, skipped, purged }
}
