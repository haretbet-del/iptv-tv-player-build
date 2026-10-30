'use client'

import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useRemoteHandler } from '@/hooks/use-remote'
import { focusFirst, moveFocus } from '@/lib/iptv/spatial-nav'

interface TvDialogProps {
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  closable?: boolean
}

export function TvDialog({ title, description, onClose, children, closable = true }: TvDialogProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (ref.current) focusFirst(ref.current)
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  useRemoteHandler((action) => {
    if (action === 'back') {
      if (closable) onClose()
    } else if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      moveFocus(action)
    } else if (action === 'ok') {
      const el = document.activeElement as HTMLElement | null
      if (el && ref.current?.contains(el)) el.click()
      else if (ref.current) focusFirst(ref.current)
    }
    return true
  }, 30)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8 backdrop-blur-sm">
      <div
        ref={ref}
        data-nav-scope="30"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tv-dialog-title"
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-popover shadow-2xl"
      >
        <header className="flex items-start justify-between gap-6 border-b border-border px-10 py-7">
          <div>
            <h2 id="tv-dialog-title" className="text-3xl font-bold">
              {title}
            </h2>
            {description && <p className="mt-1 text-lg text-muted-foreground">{description}</p>}
          </div>
          {closable && (
            <button
              type="button"
              data-nav
              onClick={onClose}
              aria-label="Закрыть"
              className="rounded-xl bg-secondary p-3 text-foreground"
            >
              <X aria-hidden="true" className="size-6" />
            </button>
          )}
        </header>
        <div className="tv-scroll min-h-0 flex-1 overflow-y-auto px-10 py-8">{children}</div>
      </div>
    </div>
  )
}
