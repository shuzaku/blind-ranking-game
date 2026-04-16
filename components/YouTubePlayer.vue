<script setup lang="ts">
const props = defineProps<{
  videoId: string
  paused?: boolean   // when true, pause playback
  size?: 'sm' | 'md' | 'lg' | 'fill'
}>()

const containerId = `yt-${Math.random().toString(36).slice(2)}`
let player: any = null
const ready = ref(false)
const error = ref(false)

function extractId(urlOrId: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = urlOrId.match(p)
    if (m) return m[1]
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(urlOrId)) return urlOrId
  return urlOrId
}

function extractStart(urlOrId: string): number {
  // t= can be raw seconds (t=52) or h/m/s format (t=1h2m3s)
  const m = urlOrId.match(/[?&#]t=([0-9hms]+)/)
  if (!m) return 0
  const raw = m[1]
  // Already plain seconds
  if (/^\d+$/.test(raw)) return parseInt(raw)
  // Parse h/m/s notation
  let seconds = 0
  const h = raw.match(/(\d+)h/)
  const min = raw.match(/(\d+)m/)
  const s = raw.match(/(\d+)s/)
  if (h) seconds += parseInt(h[1]) * 3600
  if (min) seconds += parseInt(min[1]) * 60
  if (s) seconds += parseInt(s[1])
  return seconds
}

const videoId = computed(() => extractId(props.videoId))
const startTime = computed(() => extractStart(props.videoId))

function initPlayer() {
  if (!process.client || !videoId.value) return
  // @ts-ignore
  player = new window.YT.Player(containerId, {
    videoId: videoId.value,
    playerVars: {
      autoplay: 1,
      controls: 1,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      ...(startTime.value > 0 ? { start: startTime.value } : {}),
    },
    events: {
      onReady: () => {
        ready.value = true
        player.playVideo()
      },
      onError: () => { error.value = true },
    },
  })
}

function loadYTApi(): Promise<void> {
  return new Promise((resolve) => {
    // @ts-ignore
    if (window.YT?.Player) { resolve(); return }

    // Already loading — queue behind the existing callback
    // @ts-ignore
    if (window._ytApiLoading) {
      // @ts-ignore
      const prev = window.onYouTubeIframeAPIReady
      // @ts-ignore
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve() }
      return
    }

    // First time — inject the script
    // @ts-ignore
    window._ytApiLoading = true
    // @ts-ignore
    window.onYouTubeIframeAPIReady = () => {
      // @ts-ignore
      window._ytApiLoading = false
      resolve()
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
}

onMounted(async () => {
  if (!process.client) return
  try {
    await loadYTApi()
    initPlayer()
  } catch { error.value = true }
})

onBeforeUnmount(() => {
  try { player?.destroy() } catch {}
})

// Watch paused prop → pause/resume
watch(() => props.paused, (isPaused) => {
  if (!player || !ready.value) return
  try {
    if (isPaused) player.pauseVideo()
    else player.playVideo()
  } catch {}
})

// Watch videoId changes → load new video
watch(videoId, (id) => {
  if (!player || !ready.value || !id) return
  try {
    player.loadVideoById({ videoId: id, startSeconds: startTime.value })
  } catch {}
})

const dimensions = computed(() => {
  if (props.size === 'fill') return { w: '100%', h: '100%' }
  if (props.size === 'sm') return { w: '100%', h: '200px' }
  if (props.size === 'lg') return { w: '100%', h: '100%' }
  return { w: '100%', h: '300px' }
})
</script>

<template>
  <div class="yt-player-wrap" :style="`width:${dimensions.w}; height:${dimensions.h}`">
    <div v-if="error" class="yt-error">
      <span style="font-size:2rem;">⚠</span>
      <p>Couldn't load video</p>
    </div>
    <div v-else :id="containerId" class="yt-player-inner" />
  </div>
</template>

<style scoped>
.yt-player-wrap {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 16px;
  overflow: hidden;
}

.yt-player-inner {
  width: 100%;
  height: 100%;
}

/* Force the injected iframe to fill the container */
.yt-player-inner :deep(iframe) {
  width: 100% !important;
  height: 100% !important;
  border: none;
}

.yt-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.5rem;
  color: var(--text-muted);
}
</style>
