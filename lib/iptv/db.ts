import type { Playlist, Programme } from './types'

const DB_NAME = 'ultra-iptv'
const DB_VERSION = 1
const PROGRAMMES = 'programmes'
const META = 'meta'

export const EPG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(PROGRAMMES)) {
        const store = db.createObjectStore(PROGRAMMES, { keyPath: 'id' })
        store.createIndex('channel_start', ['channel', 'start'])
        store.createIndex('stop', 'stop')
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })
  return dbPromise
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  return request(db.transaction(META).objectStore(META).get(key)) as Promise<T | undefined>
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(META, 'readwrite')
  tx.objectStore(META).put(value, key)
  await done(tx)
}

export const loadPlaylist = () => getMeta<Playlist>('playlist')
export const savePlaylist = (p: Playlist) => setMeta('playlist', p)

export interface EpgMeta {
  url: string
  updatedAt: number
  count: number
}

export const getEpgMeta = () => getMeta<EpgMeta>('epg')
export const setEpgMeta = (m: EpgMeta) => setMeta('epg', m)

export async function putProgrammes(items: Programme[]): Promise<void> {
  if (!items.length) return
  const db = await openDb()
  const tx = db.transaction(PROGRAMMES, 'readwrite')
  const store = tx.objectStore(PROGRAMMES)
  for (const item of items) store.put(item)
  await done(tx)
}

export async function clearProgrammes(): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([PROGRAMMES, META], 'readwrite')
  tx.objectStore(PROGRAMMES).clear()
  tx.objectStore(META).delete('epg')
  await done(tx)
}

/** Removes programmes that ended more than 7 days ago. */
export async function purgeOldProgrammes(now = Date.now()): Promise<number> {
  const db = await openDb()
  const tx = db.transaction(PROGRAMMES, 'readwrite')
  const index = tx.objectStore(PROGRAMMES).index('stop')
  let removed = 0
  const cursorReq = index.openCursor(IDBKeyRange.upperBound(now - EPG_RETENTION_MS))
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result
    if (cursor) {
      cursor.delete()
      removed++
      cursor.continue()
    }
  }
  await done(tx)
  return removed
}

export async function countProgrammes(): Promise<number> {
  const db = await openDb()
  return request(db.transaction(PROGRAMMES).objectStore(PROGRAMMES).count())
}

export async function getProgrammes(channel: string, from: number, to: number): Promise<Programme[]> {
  const db = await openDb()
  const index = db.transaction(PROGRAMMES).objectStore(PROGRAMMES).index('channel_start')
  const items = await request(index.getAll(IDBKeyRange.bound([channel, from], [channel, to])))
  return items as Programme[]
}

/** Returns the currently airing programme for every requested channel key in one transaction. */
export async function getNowPlaying(channels: string[], now = Date.now()): Promise<Record<string, Programme>> {
  const result: Record<string, Programme> = {}
  if (!channels.length) return result
  const db = await openDb()
  const tx = db.transaction(PROGRAMMES)
  const index = tx.objectStore(PROGRAMMES).index('channel_start')
  for (const key of new Set(channels)) {
    const req = index.openCursor(IDBKeyRange.bound([key, 0], [key, now]), 'prev')
    req.onsuccess = () => {
      const cursor = req.result
      const value = cursor?.value as Programme | undefined
      if (value && value.stop > now) result[key] = value
    }
  }
  await done(tx)
  return result
}
