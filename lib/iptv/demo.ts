export const DEMO_CHANNELS = [
  { id: 'ultra.news', name: 'Ultra News', group: 'Новости', logo: '/logos/ultra-news.png', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'world.live', name: 'World Live 24', group: 'Новости', logo: '', url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8' },
  { id: 'cinema.one', name: 'Cinema One HD', group: 'Кино', logo: '/logos/cinema-one.png', url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8' },
  { id: 'cinema.classic', name: 'Classic Movies', group: 'Кино', logo: '', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'sport.arena', name: 'Sport Arena', group: 'Спорт', logo: '/logos/sport-arena.png', url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8' },
  { id: 'sport.extreme', name: 'Extreme Sports', group: 'Спорт', logo: '', url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8' },
  { id: 'nature.planet', name: 'Planet Nature', group: 'Познавательные', logo: '/logos/planet-nature.png', url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8' },
  { id: 'kids.fun', name: 'Kids Fun', group: 'Детские', logo: '', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'music.hits', name: 'Music Hits', group: 'Музыка', logo: '/logos/music-hits.png', url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8' },
]

export function buildDemoPlaylist(): string {
  const lines = ['#EXTM3U url-tvg="/api/demo-epg" catchup="shift" catchup-days="3"']
  for (const c of DEMO_CHANNELS) {
    const logo = c.logo ? ` tvg-logo="${c.logo}"` : ''
    lines.push(`#EXTINF:-1 tvg-id="${c.id}" tvg-name="${c.name}"${logo} group-title="${c.group}",${c.name}`)
    lines.push(c.url)
  }
  return lines.join('\n')
}
