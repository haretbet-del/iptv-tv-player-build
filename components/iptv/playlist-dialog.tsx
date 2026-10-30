'use client'

import { FileUp, Link2, Loader2, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { buildDemoPlaylist } from '@/lib/iptv/demo'
import { proxied } from '@/lib/iptv/epg'
import { parseM3U } from '@/lib/iptv/m3u'
import type { Playlist } from '@/lib/iptv/types'
import { TvDialog } from './tv-dialog'

interface PlaylistDialogProps {
  onLoaded: (playlist: Playlist) => void
  onClose: () => void
  closable: boolean
  initialUrl?: string
}

export function PlaylistDialog({ onLoaded, onClose, closable, initialUrl = '' }: PlaylistDialogProps) {
  const [url, setUrl] = useState(initialUrl)
  const [busy, setBusy] = useState<null | 'url' | 'file'>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const finish = (text: string, meta: Pick<Playlist, 'name' | 'source' | 'url'>) => {
    const playlist = parseM3U(text, meta)
    if (!playlist.channels.length) throw new Error('В плейлисте не найдено ни одного канала')
    onLoaded(playlist)
  }

  const loadUrl = async () => {
    const value = url.trim()
    if (!/^https?:\/\//i.test(value)) {
      setError('Введите корректную ссылку, начинающуюся с http:// или https://')
      return
    }
    setBusy('url')
    setError('')
    try {
      const res = await fetch(proxied(value))
      if (!res.ok) throw new Error(`Сервер ответил ошибкой ${res.status}`)
      const text = await res.text()
      finish(text, { name: new URL(value).hostname, source: 'url', url: value })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить плейлист')
    } finally {
      setBusy(null)
    }
  }

  const loadFile = async (file: File) => {
    setBusy('file')
    setError('')
    try {
      finish(await file.text(), { name: file.name.replace(/\.(m3u8?|txt)$/i, ''), source: 'file' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось прочитать файл')
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const actionClass =
    'flex items-center justify-center gap-3 rounded-2xl px-7 py-5 text-xl font-semibold disabled:opacity-50'

  return (
    <TvDialog
      title="Плейлист M3U"
      description="Загрузите плейлист по ссылке или файлом. Логотипы и EPG подтянутся автоматически."
      onClose={onClose}
      closable={closable}
    >
      <div className="flex flex-col gap-8">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            loadUrl()
          }}
        >
          <label htmlFor="playlist-url" className="text-xl font-medium">
            Ссылка на плейлист
          </label>
          <div className="flex gap-4">
            <input
              id="playlist-url"
              data-nav
              data-nav-autofocus
              type="url"
              inputMode="url"
              autoComplete="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/playlist.m3u"
              className="min-w-0 flex-1 rounded-2xl border border-input bg-background px-6 py-5 text-xl placeholder:text-muted-foreground"
            />
            <button type="submit" data-nav disabled={!!busy} className={`${actionClass} bg-primary text-primary-foreground`}>
              {busy === 'url' ? <Loader2 aria-hidden="true" className="size-6 animate-spin" /> : <Link2 aria-hidden="true" className="size-6" />}
              Загрузить
            </button>
          </div>
        </form>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            data-nav
            disabled={!!busy}
            onClick={() => fileRef.current?.click()}
            className={`${actionClass} bg-secondary`}
          >
            {busy === 'file' ? <Loader2 aria-hidden="true" className="size-6 animate-spin" /> : <FileUp aria-hidden="true" className="size-6" />}
            Открыть файл .m3u
          </button>
          <button
            type="button"
            data-nav
            disabled={!!busy}
            onClick={() => {
              try {
                finish(buildDemoPlaylist(), { name: 'Демо-плейлист', source: 'demo' })
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Ошибка')
              }
            }}
            className={`${actionClass} bg-secondary`}
          >
            <Sparkles aria-hidden="true" className="size-6" />
            Демо-плейлист
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".m3u,.m3u8,.txt,audio/x-mpegurl,application/x-mpegurl"
            className="sr-only"
            tabIndex={-1}
            aria-label="Файл плейлиста"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) loadFile(file)
            }}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-destructive/15 px-6 py-4 text-lg text-destructive">
            {error}
          </p>
        )}

        <p className="text-base leading-relaxed text-muted-foreground">
          Поддерживаются теги tvg-id, tvg-name, tvg-logo, group-title, catchup, catchup-source, catchup-days и
          url-tvg / x-tvg-url в заголовке #EXTM3U.
        </p>
      </div>
    </TvDialog>
  )
}
