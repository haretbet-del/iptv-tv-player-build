'use client'

import { useEffect, useRef } from 'react'
import { focusFirst, moveFocus } from '@/lib/iptv/spatial-nav'
import type { KeyMap, RemoteAction } from '@/lib/iptv/types'

type Handler = (action: RemoteAction, event: KeyboardEvent) => boolean | void

interface Entry {
  priority: number
  order: number
  handler: Handler
}

const handlers: Entry[] = []
let orderCounter = 0
let captureCallback: ((key: string) => void) | null = null

/** Captures the very next key press (used for key remapping). */
export function captureNextKey(cb: ((key: string) => void) | null) {
  captureCallback = cb
}

/**
 * Registers a remote-control handler. Higher priority handlers run first;
 * return `true` to consume the action and skip default spatial navigation.
 */
export function useRemoteHandler(handler: Handler, priority: number, enabled = true) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!enabled) return
    const entry: Entry = { priority, order: orderCounter++, handler: (a, e) => ref.current(a, e) }
    handlers.push(entry)
    return () => {
      const i = handlers.indexOf(entry)
      if (i >= 0) handlers.splice(i, 1)
    }
  }, [priority, enabled])
}

const TEXT_TYPES = new Set(['text', 'url', 'search', 'email', 'password', 'number', 'tel'])

function isTextField(el: EventTarget | null): boolean {
  if (el instanceof HTMLTextAreaElement) return true
  return el instanceof HTMLInputElement && TEXT_TYPES.has(el.type)
}

export function useRemoteController(keyMap: KeyMap) {
  const mapRef = useRef(keyMap)
  useEffect(() => {
    mapRef.current = keyMap
  }, [keyMap])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (captureCallback) {
        e.preventDefault()
        e.stopPropagation()
        const cb = captureCallback
        captureCallback = null
        cb(e.key)
        return
      }

      const map = mapRef.current
      const action = (Object.keys(map) as RemoteAction[]).find((a) => map[a].includes(e.key))
      if (!action) return

      if (isTextField(e.target)) {
        const allowed = action === 'up' || action === 'down' || (action === 'back' && e.key !== 'Backspace')
        if (!allowed) return
      }

      e.preventDefault()

      const sorted = [...handlers].sort((a, b) => b.priority - a.priority || b.order - a.order)
      for (const entry of sorted) {
        if (entry.handler(action, e)) return
      }

      if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
        moveFocus(action)
      } else if (action === 'ok') {
        const el = document.activeElement as HTMLElement | null
        if (el && el !== document.body) el.click()
        else focusFirst()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
