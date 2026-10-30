export type Direction = 'up' | 'down' | 'left' | 'right'

const FOCUSABLE = '[data-nav]'

function isVisible(el: HTMLElement): boolean {
  if (el.closest('[inert]')) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

/** The top-most navigation scope (dialogs, overlays) traps focus. */
export function getActiveScope(): HTMLElement {
  const scopes = Array.from(document.querySelectorAll<HTMLElement>('[data-nav-scope]')).filter(isVisible)
  if (!scopes.length) return document.body
  return scopes.reduce((top, s) => {
    const p = Number(s.dataset.navScope || 0)
    const tp = Number(top.dataset.navScope || 0)
    return p >= tp ? s : top
  })
}

export function getFocusables(scope: HTMLElement = getActiveScope()): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible)
}

export function focusElement(el: HTMLElement | null | undefined): boolean {
  if (!el) return false
  el.focus({ preventScroll: true })
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  return true
}

/** Focuses the preferred element of a scope: [data-nav-autofocus] → [data-nav-active] → first. */
export function focusFirst(scope: HTMLElement = getActiveScope()): boolean {
  const all = getFocusables(scope)
  const preferred =
    all.find((el) => el.hasAttribute('data-nav-autofocus')) ??
    all.find((el) => el.dataset.navActive === 'true') ??
    all[0]
  return focusElement(preferred)
}

export function focusById(id: string): boolean {
  const el = getFocusables().find((e) => e.dataset.navId === id)
  return focusElement(el)
}

function center(r: DOMRect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

function pickBest(from: DOMRect, candidates: HTMLElement[], dir: Direction): HTMLElement | null {
  const c0 = center(from)
  let best: HTMLElement | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const el of candidates) {
    const r = el.getBoundingClientRect()
    const c = center(r)
    let primary: number
    let secondary: number
    switch (dir) {
      case 'right':
        if (c.x <= c0.x) continue
        primary = Math.max(0, r.left - from.right)
        secondary = Math.abs(c.y - c0.y)
        break
      case 'left':
        if (c.x >= c0.x) continue
        primary = Math.max(0, from.left - r.right)
        secondary = Math.abs(c.y - c0.y)
        break
      case 'down':
        if (c.y <= c0.y) continue
        primary = Math.max(0, r.top - from.bottom)
        secondary = Math.abs(c.x - c0.x)
        break
      case 'up':
        if (c.y >= c0.y) continue
        primary = Math.max(0, from.top - r.bottom)
        secondary = Math.abs(c.x - c0.x)
        break
    }
    const overlaps =
      dir === 'left' || dir === 'right'
        ? r.top < from.bottom && r.bottom > from.top
        : r.left < from.right && r.right > from.left
    const score = primary + secondary * (overlaps ? 0.5 : 3)
    if (score < bestScore) {
      bestScore = score
      best = el
    }
  }
  return best
}

/**
 * Moves focus geometrically. Elements inside the same [data-nav-group] are preferred.
 * When leaving a group, focus lands on that group's [data-nav-active] element if it exists.
 */
export function moveFocus(dir: Direction): boolean {
  const scope = getActiveScope()
  const all = getFocusables(scope)
  if (!all.length) return false

  const current = document.activeElement as HTMLElement | null
  if (!current || !all.includes(current)) return focusFirst(scope)

  const from = current.getBoundingClientRect()
  const group = current.closest<HTMLElement>('[data-nav-group]')
  const others = all.filter((e) => e !== current)

  if (group) {
    const inGroup = others.filter((e) => group.contains(e))
    const target = pickBest(from, inGroup, dir)
    if (target) return focusElement(target)
    if (group.dataset.navGroup === 'trap') return false
  }

  const outside = group ? others.filter((e) => !group.contains(e)) : others
  const target = pickBest(from, outside, dir)
  if (!target) return false

  const targetGroup = target.closest<HTMLElement>('[data-nav-group]')
  if (targetGroup && targetGroup !== group) {
    const active = getFocusables(targetGroup).find((e) => e.dataset.navActive === 'true')
    if (active) return focusElement(active)
  }
  return focusElement(target)
}
