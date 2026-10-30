export type CatchupMode = 'default' | 'append' | 'shift' | 'flussonic' | 'xc' | 'none'

export interface Channel {
  id: string
  name: string
  url: string
  logo?: string
  group: string
  tvgId?: string
  tvgName?: string
  epgKey: string
  catchup?: CatchupMode
  catchupSource?: string
  catchupDays?: number
}

export interface Playlist {
  name: string
  source: 'url' | 'file' | 'demo'
  url?: string
  epgUrl?: string
  channels: Channel[]
  groups: string[]
  loadedAt: number
}

export interface Programme {
  id: string
  channel: string
  start: number
  stop: number
  title: string
  desc?: string
}

export type ViewMode = 'grid' | 'compact'

export type ThemeMode = 'cinema' | 'space' | 'cyberpunk' | 'light'

export type FocusColor = 'orange' | 'green' | 'blue' | 'red'

export type RemoteAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'ok'
  | 'back'
  | 'menu'
  | 'chUp'
  | 'chDown'
  | 'info'

export type KeyMap = Record<RemoteAction, string[]>

export interface Settings {
  viewMode: ViewMode
  autoplayLast: boolean
  epgUrlOverride: string
  keyMap: KeyMap
  themeMode: ThemeMode
  focusColor: FocusColor
}

export interface PlaybackTarget {
  channel: Channel
  archive?: Programme
}

export const ALL_CHANNELS = '__all__'