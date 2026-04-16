<script setup lang="ts">
const route = useRoute()
const { $socket } = useNuxtApp()
const { play } = useSound()
const code = (route.params.code as string).toUpperCase()

// ── State ─────────────────────────────────────────────────────────────────────
type Phase = 'connecting' | 'lobby' | 'ranking' | 'social' | 'results'
const phase = ref<Phase>('connecting')
const listName = ref('')
const totalItems = ref(0)
const players = ref<Array<{ id: string; name: string; connected: boolean }>>([])
const errorMsg = ref('')

// Ranking phase
const currentItem = ref<{ text: string; imageUrl: string; youtubeUrl?: string } | null>(null)
const currentItemNumber = ref(0)
const placedCount = ref(0)
const recentPlacements = ref<Array<{ name: string; slot: number }>>([])
const playerRankings = ref<Record<string, Record<number, { text: string; imageUrl: string }>>>({})
const rankingComplete = ref(false)

// Next-item countdown overlay
const nextItemCountdown = ref(0)
let nextItemTimer: ReturnType<typeof setInterval> | null = null

function startNextItemCountdown() {
  if (nextItemTimer) clearInterval(nextItemTimer)
  nextItemCountdown.value = 3
  play('tick')                          // play on 3 immediately
  nextItemTimer = setInterval(() => {
    nextItemCountdown.value--
    if (nextItemCountdown.value <= 0) {
      clearInterval(nextItemTimer!)
      nextItemTimer = null
      play('whoosh')                    // punchy "go!" sound when 0 is reached
    } else {
      play('tick')                      // play on 2, then 1
    }
  }, 1000)
}

// Social phase
const stats = ref<any>(null)
const currentQuestion = ref<any>(null)
const questionNumber = ref(0)
const totalQuestions = ref(0)
const answerCount = ref(0)
const answeredPlayerIds = ref<string[]>([])
const answerRevealed = ref(false)
const revealData = ref<any>(null)
const runningScores = ref<Array<{ id: string; name: string; score: number }>>([])
const showStatsFirst = ref(false)

// Defense round 3-minute timer
const defenseSecondsLeft = ref(0)
let defenseTimer: ReturnType<typeof setInterval> | null = null

function startDefenseTimer() {
  defenseSecondsLeft.value = 180
  if (defenseTimer) clearInterval(defenseTimer)
  defenseTimer = setInterval(() => {
    defenseSecondsLeft.value--
    if (defenseSecondsLeft.value <= 0) {
      clearInterval(defenseTimer!)
      defenseTimer = null
    }
  }, 1000)
}

function stopDefenseTimer() {
  if (defenseTimer) { clearInterval(defenseTimer); defenseTimer = null }
  defenseSecondsLeft.value = 0
}

const defenseTimerDisplay = computed(() => {
  const m = Math.floor(defenseSecondsLeft.value / 60)
  const s = defenseSecondsLeft.value % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

// Auto-advance countdown
const autoAdvanceCountdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

function startAutoAdvance() {
  autoAdvanceCountdown.value = 10
  countdownTimer = setInterval(() => {
    autoAdvanceCountdown.value--
    play('countdown')
    if (autoAdvanceCountdown.value <= 0) {
      clearInterval(countdownTimer!)
      countdownTimer = null
      nextQuestion()
    }
  }, 1000)
}

function cancelAutoAdvance() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  autoAdvanceCountdown.value = 0
}

// QR code
const qrCanvas = ref<HTMLCanvasElement | null>(null)

async function renderQr() {
  if (!qrCanvas.value || !joinUrl.value) return
  const QRCode = (await import('qrcode')).default
  QRCode.toCanvas(qrCanvas.value, joinUrl.value, {
    width: 200,
    margin: 2,
    color: { dark: '#f1f5f9', light: '#1a1a3a' }
  })
}

onMounted(() => {
  watch([joinUrl, qrCanvas], ([url, canvas]) => {
    if (url && canvas) renderQr()
  }, { immediate: true })
})

// Results
const finalResults = ref<any[]>([])
const allItems = ref<any[]>([])

// ── Socket ────────────────────────────────────────────────────────────────────
onMounted(() => {
  $socket.connect()

  $socket.on('connect', () => { $socket.emit('host-join', { code }) })

  $socket.on('host-joined', (data: any) => {
    listName.value = data.listName
    totalItems.value = data.totalItems
    players.value = data.players
    phase.value = (data.status === 'lobby' ? 'lobby' : data.status) as Phase
    for (const p of data.players) playerRankings.value[p.id] = {}
  })

  $socket.on('player-joined', (data: any) => {
    players.value = data.players
    for (const p of data.players) {
      if (!playerRankings.value[p.id]) playerRankings.value[p.id] = {}
    }
    play('playerJoin')
  })

  $socket.on('player-left', (data: any) => {
    players.value = data.players
    play('pop')
  })

  $socket.on('game-started', (data: any) => {
    totalItems.value = data.totalItems
    phase.value = 'ranking'
    placedCount.value = 0
    rankingComplete.value = false
    playerRankings.value = {}
    for (const p of players.value) playerRankings.value[p.id] = {}
    play('gameStart')
  })

  $socket.on('item-revealed', (data: any) => {
    // Clear any in-progress countdown
    if (nextItemTimer) { clearInterval(nextItemTimer); nextItemTimer = null }
    nextItemCountdown.value = 0
    currentItem.value = data.item
    currentItemNumber.value = data.itemNumber
    placedCount.value = 0
    recentPlacements.value = []
    lastPlacedNames.value = []
    currentQuip.value = ''
    play('itemReveal')
  })

  $socket.on('placement-update', (data: any) => {
    placedCount.value = data.placedCount
    recentPlacements.value = [{ name: data.playerName, slot: data.slot }, ...recentPlacements.value].slice(0, 8)
    if (data.playerName && !lastPlacedNames.value.includes(data.playerName)) {
      lastPlacedNames.value.push(data.playerName)
    }
    if (currentItem.value && playerRankings.value[data.playerId]) {
      playerRankings.value[data.playerId][data.slot] = { ...currentItem.value }
    }
    play('placement')
  })

  $socket.on('round-complete', (data: any) => {
    if (data.isLastItem) {
      rankingComplete.value = true
      play('roundComplete')
    } else {
      play('allPlaced')
      startNextItemCountdown()
    }
  })

  $socket.on('social-started', (data: any) => {
    stats.value = data.stats
    totalQuestions.value = data.totalQuestions
    phase.value = 'social'
    showStatsFirst.value = true
    answerRevealed.value = false
    answerCount.value = 0
    play('socialStart')
  })

  $socket.on('social-question', (data: any) => {
    cancelAutoAdvance()
    stopDefenseTimer()
    showStatsFirst.value = false
    currentQuestion.value = data.question
    questionNumber.value = data.questionNumber
    totalQuestions.value = data.totalQuestions
    answerRevealed.value = false
    answerCount.value = 0
    answeredPlayerIds.value = []
    revealData.value = null
    play('whoosh')
    if (data.question?.category === 'defense') {
      startDefenseTimer()
    }
  })

  $socket.on('social-answer-count', (data: any) => {
    answerCount.value = data.count
    answeredPlayerIds.value = data.answeredPlayerIds ?? []
    play('answerIn')
  })

  $socket.on('social-answer-revealed', (data: any) => {
    stopDefenseTimer()
    answerRevealed.value = true
    revealData.value = data
    runningScores.value = data.runningScores
    startAutoAdvance()
    play('reveal')
  })

  $socket.on('game-over', (data: any) => {
    phase.value = 'results'
    finalResults.value = data.results
    allItems.value = data.items
    stats.value = data.stats
    play('fanfare')
  })

  $socket.on('error', (data: any) => {
    errorMsg.value = data.message
    setTimeout(() => { errorMsg.value = '' }, 4000)
  })
})

onBeforeUnmount(() => {
  cancelAutoAdvance()
  stopDefenseTimer()
  if (nextItemTimer) { clearInterval(nextItemTimer); nextItemTimer = null }
  ;['connect','host-joined','player-joined','player-left','game-started','item-revealed',
   'placement-update','round-complete','social-started','social-question','social-answer-count',
   'social-answer-revealed','game-over','error'].forEach(e => $socket.off(e))
  $socket.disconnect()
})

// ── Actions ───────────────────────────────────────────────────────────────────
const startGame = () => { play('whoosh'); $socket.emit('start-game', { code }) }
const skipReveal = () => { play('click'); $socket.emit('reveal-next', { code }) }
const goToSocial = () => { play('whoosh'); $socket.emit('start-social', { code }) }
const revealAnswer = () => { play('reveal'); $socket.emit('reveal-answer', { code }) }
const nextQuestion = () => { play('click'); $socket.emit('next-question', { code }) }

// ── Owl quips ─────────────────────────────────────────────────────────────────
const currentQuip = ref('')
const lastPlacedNames = ref<string[]>([])

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildQuip(names: string[]) {
  if (!names.length) return 'The owl has opinions.'

  const all = names.join(' & ')
  const one = names[0]

  const templates = [
    // judgemental
    () => `Really, ${one}?`,
    () => `${one}... are you sure about that?`,
    () => `${all} should reconsider their life choices.`,
    () => `The owl is disappointed, ${one}.`,
    () => `${one}, the audacity!`,
    () => `Bold move, ${one}. Bold move.`,
    () => `${all}... the owl is watching.`,
    () => `${one}, that's a choice.`,
    () => `Yikes, ${one}.`,
    () => `${all} ranked that with full confidence. Scary.`,
    // supportive
    () => `${one} knows their stuff!`,
    () => `${all}, solid ranking!`,
    () => `The owl approves of ${one}.`,
    () => `${one} is playing to win.`,
    () => `${all} — great taste!`,
    () => `${one} with the power move!`,
    () => `${all}, no notes.`,
    () => `${one} gets it.`,
    () => `${all} — the owl is impressed.`,
    () => `${one} is built different.`,
  ]

  return pick(templates)()
}

function pickQuip() {
  currentQuip.value = buildQuip(lastPlacedNames.value)
}

// ── Computed ──────────────────────────────────────────────────────────────────
const activePlayers = computed(() => players.value.filter(p => p.connected))
const allPlaced = computed(() => placedCount.value >= activePlayers.value.length && activePlayers.value.length > 0)

watch(allPlaced, (val) => { if (val) pickQuip() })
const progressPct = computed(() => totalItems.value > 0 ? (currentItemNumber.value / totalItems.value) * 100 : 0)
const joinUrl = computed(() => process.client ? `${window.location.origin}/play/${code}` : `/play/${code}`)

const isLastQuestion = computed(() =>
  questionNumber.value >= totalQuestions.value
)

function rankEmoji(i: number) {
  return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`
}

function optionLabel(question: any, answerId: string) {
  return question?.options?.find((o: any) => o.id === answerId)?.label ?? answerId
}
</script>

<template>
  <div class="page host-screen" style="height:100vh; overflow:hidden; padding:1rem 1.5rem;">

    <div v-if="errorMsg" class="toast toast--error">{{ errorMsg }}</div>

    <!-- Connecting -->
    <div v-if="phase === 'connecting'" class="flex-center" style="height:80vh;flex-direction:column;gap:1rem;">
      <div class="spinner" style="width:56px;height:56px;border-width:5px;"></div>
      <p class="text-muted" style="font-size:1.4rem;">Connecting...</p>
    </div>

    <!-- ── LOBBY ──────────────────────────────────────────────────────────── -->
    <div v-if="phase === 'lobby'" class="container--wide">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2.5rem;align-items:start;">

        <div>
          <div class="code-card">
            <p style="font-size:1rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-muted);margin-bottom:0.5rem;">Players join at</p>
            <p style="font-size:1.2rem;color:var(--cyan);margin-bottom:1rem;">{{ joinUrl }}</p>
            <div class="lobby-code" style="margin-bottom:1.25rem;">{{ code }}</div>
            <canvas ref="qrCanvas" style="border-radius:12px; display:block; margin:0 auto;"></canvas>
          </div>

          <div class="card mt-lg">
            <div style="display:flex; justify-content:center; margin-bottom:1.25rem;">
              <OwlMascot
                size="md"
                :mood="activePlayers.length === 0 ? 'thinking' : 'excited'"
                :message="activePlayers.length === 0 ? 'Waiting for your wise flock...' : `${activePlayers.length} owl${activePlayers.length !== 1 ? 's' : ''} ready to rank!`"
              />
            </div>
            <h2>{{ listName }}</h2>
            <p class="text-muted mt-sm" style="font-size:1.1rem;">{{ totalItems }} items · Players rank from their own perspective</p>
            <div class="divider"></div>
            <p class="text-muted" style="font-size:1rem;margin-bottom:1.25rem;">
              Items appear one at a time. Each player places them in personal slots — no right answers!
              Afterwards, a social deduction round reveals who ranked what.
            </p>
            <button
              class="btn btn--primary btn--lg btn--block"
              style="font-size:1.2rem; padding:1.1rem 2rem;"
              :disabled="activePlayers.length === 0"
              @click="startGame"
            >
              {{ activePlayers.length === 0 ? 'Waiting for players...' : `Start with ${activePlayers.length} player${activePlayers.length !== 1 ? 's' : ''}` }}
            </button>
          </div>
        </div>

        <div class="card">
          <h2 style="margin-bottom:1.25rem; font-size:1.8rem;">
            Players
            <span class="badge badge--green" style="margin-left:0.75rem; font-size:1rem; padding:0.3rem 0.9rem;">{{ activePlayers.length }}</span>
          </h2>
          <div v-if="players.length === 0" class="text-center" style="padding:3rem;color:var(--text-dim);">
            <div class="waiting-dots" style="font-size:2rem;"><span>●</span><span>●</span><span>●</span></div>
            <p class="mt-sm" style="font-size:1.2rem;">Waiting for players to join...</p>
          </div>
          <div v-else class="player-grid" style="gap:0.75rem;">
            <div v-for="p in players" :key="p.id" class="player-chip host-player-chip" :class="{disconnected:!p.connected}">
              <div class="player-dot" style="width:10px;height:10px;"></div>
              {{ p.name }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── RANKING PHASE ─────────────────────────────────────────────────── -->
    <div v-if="phase === 'ranking'" class="ranking-screen">

      <!-- Top bar: code · list name · progress · item counter -->
      <div class="ranking-topbar">
        <div class="flex gap-md" style="align-items:center;">
          <span class="badge badge--cyan" style="font-size:0.95rem; padding:0.35rem 0.9rem; letter-spacing:0.15em;">{{ code }}</span>
          <span class="text-muted" style="font-size:1.1rem; font-weight:600;">{{ listName }}</span>
        </div>
        <div class="ranking-topbar__progress">
          <div class="progress-bar" style="height:8px; width:200px;">
            <div class="progress-bar__fill" :style="{ width: progressPct + '%' }"></div>
          </div>
          <span style="font-weight:800; font-size:1.2rem;">{{ currentItemNumber }} / {{ totalItems }}</span>
        </div>
      </div>

      <!-- All items ranked -->
      <div v-if="rankingComplete" class="card card--glow text-center ranking-complete-card">
        <div style="font-size:3rem;margin-bottom:1rem;">🎉</div>
        <h2 style="font-size:2.2rem;">All items ranked!</h2>
        <p class="text-muted mt-sm" style="font-size:1.2rem;">Ready for social deduction?</p>
        <button class="btn btn--primary btn--lg mt-lg" style="font-size:1.3rem; padding:1.1rem 2.5rem;" @click="goToSocial">
          Start Social Round →
        </button>
      </div>

      <!-- Two-column layout: left = media + owl, right = players -->
      <div v-else class="ranking-body" :class="{ 'ranking-body--countdown': nextItemCountdown > 0 }">

        <!-- LEFT: media + owl + placed bar -->
        <div class="ranking-left">
          <!-- YouTube -->
          <div v-if="currentItem?.youtubeUrl" class="ranking-video-wrap">
            <YouTubePlayer
              :key="currentItem.youtubeUrl"
              :videoId="currentItem.youtubeUrl"
              :paused="allPlaced"
              size="lg"
            />
            <div v-if="allPlaced" class="yt-paused-banner">
              ⏸ Paused — everyone has placed!
            </div>
          </div>

          <!-- Image fallback -->
          <img
            v-else-if="currentItem?.imageUrl"
            :src="currentItem.imageUrl"
            class="ranking-item-img"
          />

          <!-- Owl -->
          <div v-if="currentItem" class="ranking-owl-row">
            <OwlMascot
              size="lg"
              :mood="allPlaced ? 'celebrate' : 'excited'"
              :message="allPlaced ? currentQuip : currentItem.text"
            />
          </div>

          <!-- Placed progress + skip -->
          <div class="ranking-placed-row">
            <div style="flex:1;">
              <div class="flex-between" style="margin-bottom:0.5rem;">
                <span class="text-muted" style="font-size:0.9rem; text-transform:uppercase; letter-spacing:0.08em; font-weight:700;">Placed</span>
                <span style="font-weight:800; font-size:1.2rem;">{{ placedCount }} / {{ activePlayers.length }}</span>
              </div>
              <div class="progress-bar" style="height:8px;">
                <div class="progress-bar__fill"
                  :style="{width: activePlayers.length > 0 ? (placedCount/activePlayers.length*100)+'%':'0%',
                           background: allPlaced ? 'var(--green)' : undefined}">
                </div>
              </div>
            </div>
            <button class="btn btn--ghost" style="flex-shrink:0; font-size:1rem;" @click="skipReveal">
              Skip →
            </button>
          </div>

          <!-- Next-item countdown overlay -->
          <Transition name="countdown-fade">
            <div v-if="nextItemCountdown > 0" class="next-item-countdown">
              <div class="next-item-countdown__label">Next item in</div>
              <div class="next-item-countdown__number">{{ nextItemCountdown }}</div>
            </div>
          </Transition>
        </div>

        <!-- RIGHT: player rankings grid -->
        <div class="ranking-right">
          <h3 class="ranking-right__heading">Everyone's Rankings</h3>
          <div class="rankings-grid ranking-grid--fit">
            <div v-for="(player, playerIndex) in activePlayers" :key="player.id" class="player-ranking">
              <div class="player-ranking__name">
                <div class="player-dot" style="width:7px;height:7px;"></div>
                Player {{ playerIndex + 1 }}
              </div>
              <div v-for="slot in totalItems" :key="slot">
                <div class="mini-slot" :class="playerRankings[player.id]?.[slot] ? 'filled' : 'empty'">
                  <span class="mini-slot__rank">#{{ slot }}</span>
                  <template v-if="playerRankings[player.id]?.[slot]">
                    <img v-if="playerRankings[player.id][slot]?.imageUrl"
                      :src="playerRankings[player.id][slot]!.imageUrl"
                      style="width:16px;height:16px;object-fit:cover;border-radius:3px;flex-shrink:0;"
                    />
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.8rem;">
                      {{ playerRankings[player.id][slot]?.text }}
                    </span>
                  </template>
                  <span v-else style="color:var(--text-dim);font-size:0.8rem;">—</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── SOCIAL PHASE ──────────────────────────────────────────────────── -->
    <div v-if="phase === 'social'" class="container--wide">
      <!-- Stats overview shown first -->
      <div v-if="showStatsFirst && stats" style="max-width:1000px;margin:0 auto;">
        <div class="text-center" style="margin-bottom:2.5rem;">
          <div style="font-size:3rem;margin-bottom:0.75rem;">📊</div>
          <h1>Rankings Complete!</h1>
          <p class="text-muted mt-sm" style="font-size:1.2rem;">Here's how the group ranked everything...</p>
        </div>

        <!-- Item bars -->
        <div class="card" style="margin-bottom:2rem;">
          <h2 style="margin-bottom:1.5rem;">Group Rankings</h2>
          <div style="display:flex;flex-direction:column;gap:1.25rem;">
            <div v-for="(itemStat, i) in [...stats.items].sort((a:any,b:any)=>a.avgRank-b.avgRank)" :key="i">
              <div class="flex-between" style="margin-bottom:0.4rem;">
                <div class="flex gap-sm" style="align-items:center;">
                  <img v-if="itemStat.item.imageUrl" :src="itemStat.item.imageUrl"
                    style="width:36px;height:36px;object-fit:cover;border-radius:8px;"/>
                  <span style="font-weight:700; font-size:1.15rem;">{{ itemStat.item.text }}</span>
                </div>
                <span class="text-muted" style="font-size:1rem;">avg #{{ itemStat.avgRank }}</span>
              </div>
              <div class="progress-bar" style="height:8px;">
                <div class="progress-bar__fill" :style="{width: ((totalItems - itemStat.avgRank + 1) / totalItems * 100) + '%'}"></div>
              </div>
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.4rem;">
                <span v-if="itemStat.rankedFirstBy.length" style="font-size:0.9rem;color:var(--green);">
                  🥇 {{ itemStat.rankedFirstBy.join(', ') }}
                </span>
                <span v-if="itemStat.rankedLastBy.length" style="font-size:0.9rem;color:var(--red);">
                  💀 {{ itemStat.rankedLastBy.join(', ') }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Hot takes -->
        <div v-if="stats.players?.some((p:any)=>p.hotTakes?.length)" class="card" style="margin-bottom:2rem;">
          <h2 style="margin-bottom:1.25rem;">🌶️ Hot Takes</h2>
          <div style="display:flex;flex-direction:column;gap:1rem;">
            <div v-for="pStat in stats.players" :key="pStat.playerId">
              <div v-for="take in pStat.hotTakes" :key="take.item.text" class="card" style="padding:1rem;background:var(--surface); font-size:1.1rem;">
                <span style="color:var(--cyan);font-weight:700;">{{ pStat.playerName }}</span>
                ranked <strong>"{{ take.item.text }}"</strong> at
                <span style="color:var(--accent);font-weight:700;">#{{ take.playerRank }}</span>
                while the group average was
                <span style="color:var(--text-muted);">#{{ take.groupAvg }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card text-center" style="margin-bottom:2rem;" v-if="stats.mostControversial">
          <p class="text-muted" style="font-size:1rem;margin-bottom:0.5rem;">Most Controversial</p>
          <h2>🔥 "{{ stats.mostControversial.item.text }}"</h2>
          <p class="text-muted mt-sm" style="font-size:1.1rem;">The group couldn't agree on this one!</p>
        </div>

        <div class="text-center">
          <p class="text-muted" style="font-size:1.1rem;margin-bottom:1.25rem;">Ready for the social deduction round? ({{ totalQuestions }} questions)</p>
          <button class="btn btn--primary btn--lg" style="font-size:1.2rem; padding:1.1rem 2.5rem;" @click="showStatsFirst = false">
            Start Social Round →
          </button>
        </div>
      </div>

      <!-- Social question display -->
      <div v-else-if="currentQuestion" style="max-width:1000px;margin:0 auto;">
        <div class="flex-between" style="margin-bottom:1.5rem;">
          <div class="flex gap-md" style="align-items:center;">
            <span class="badge badge--cyan" style="font-size:1rem; padding:0.4rem 1rem; letter-spacing:0.15em;">{{ code }}</span>
            <span class="badge badge--yellow" style="font-size:1rem; padding:0.4rem 1rem;">{{ currentQuestion.category }}</span>
            <span class="text-muted" style="font-size:1.2rem; font-weight:600;">Q{{ questionNumber }} / {{ totalQuestions }}</span>
          </div>
          <div style="display:flex; align-items:center; gap:1rem;">
            <button v-if="!answerRevealed" class="btn btn--ghost" style="font-size:1rem;" @click="revealAnswer">
              Reveal Early
            </button>
            <template v-else>
              <div v-if="autoAdvanceCountdown > 0" style="display:flex; align-items:center; gap:0.6rem;">
                <svg viewBox="0 0 36 36" width="36" height="36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" stroke-width="3"/>
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" stroke-width="3"
                    stroke-dasharray="94.25"
                    :stroke-dashoffset="94.25 * (1 - autoAdvanceCountdown / 10)"
                    stroke-linecap="round"
                    transform="rotate(-90 18 18)"
                    style="transition: stroke-dashoffset 0.95s linear;"
                  />
                  <text x="18" y="23" text-anchor="middle" fill="var(--text)" font-size="13" font-weight="800">{{ autoAdvanceCountdown }}</text>
                </svg>
                <button class="btn btn--ghost btn--sm" @click="cancelAutoAdvance">Cancel</button>
              </div>
              <button class="btn btn--primary" style="font-size:1rem; padding:0.75rem 1.5rem;" @click="cancelAutoAdvance(); nextQuestion()">
                {{ isLastQuestion ? 'Final Results →' : 'Next Question →' }}
              </button>
            </template>
          </div>
        </div>

        <div class="progress-bar" style="height:10px; margin-bottom:2rem;">
          <div class="progress-bar__fill" :style="{width: (questionNumber/totalQuestions*100)+'%'}"></div>
        </div>

        <!-- ── DEFENSE ROUND ──────────────────────────────────────────────── -->
        <template v-if="currentQuestion.category === 'defense'">
          <!-- Defense hero card -->
          <div class="card defense-hero-card" style="margin-bottom:2rem; padding:2.5rem;">
            <div class="defense-hero-top">
              <OwlMascot size="xl" :mood="answerRevealed ? 'celebrate' : 'excited'" />
              <div class="defense-hero-body">
                <div class="badge" style="font-size:0.85rem; margin-bottom:0.75rem; background:rgba(168,85,247,0.15); border-color:rgba(168,85,247,0.4); color:#a855f7;">⚔️ Defense Round</div>
                <p class="owl-question-text" style="margin-bottom:1.25rem;">{{ currentQuestion.prompt }}</p>

                <!-- Stand-up-and-defend callout (visible while voting is open) -->
                <div v-if="!answerRevealed" class="defense-callout">
                  <span class="defense-callout__icon">🎤</span>
                  <div>
                    <p class="defense-callout__name">{{ players.find((p:any) => p.id === currentQuestion.defensePlayerId)?.name }} — stand up!</p>
                    <p class="defense-callout__desc">Tell the group why you ranked <strong>{{ currentQuestion.defenseItem }}</strong> {{ currentQuestion.defensePosition === 'first' ? '#1' : 'last' }}. You have 3 minutes to make your case. Other players vote after 30 seconds.</p>
                  </div>
                </div>

                <!-- 3-min timer (only while voting is open) -->
                <div v-if="!answerRevealed && defenseSecondsLeft > 0" class="defense-timer" :class="{ 'defense-timer--urgent': defenseSecondsLeft <= 30 }" style="margin-top:1rem;">
                  <span class="defense-timer__icon">⏱</span>
                  <span class="defense-timer__time">{{ defenseTimerDisplay }}</span>
                  <span class="defense-timer__label">to make their case</span>
                </div>
              </div>
            </div>

            <!-- Agree / Disagree live counts while voting -->
            <div v-if="!answerRevealed" style="margin-top:2rem;">
              <div class="flex-between" style="margin-bottom:0.6rem;">
                <span class="text-muted" style="font-size:1rem; text-transform:uppercase; letter-spacing:0.08em; font-weight:700;">Votes in</span>
                <span style="font-weight:800; font-size:1.4rem; color:var(--cyan);">{{ answerCount }} / {{ activePlayers.filter((p:any) => p.id !== currentQuestion.defensePlayerId).length }}</span>
              </div>
              <div class="progress-bar" style="height:10px; margin-bottom:1.25rem;">
                <div class="progress-bar__fill"
                  :style="{width: activePlayers.filter((p:any) => p.id !== currentQuestion.defensePlayerId).length > 0
                    ? (answerCount / activePlayers.filter((p:any) => p.id !== currentQuestion.defensePlayerId).length * 100) + '%' : '0%'}">
                </div>
              </div>
              <div class="player-answer-grid">
                <div
                  v-for="player in activePlayers.filter((p:any) => p.id !== currentQuestion.defensePlayerId)"
                  :key="player.id"
                  class="player-answer-chip host-answer-chip"
                  :class="answeredPlayerIds.includes(player.id) ? 'answered' : 'waiting'"
                >
                  <span class="player-answer-icon">{{ answeredPlayerIds.includes(player.id) ? '✓' : '…' }}</span>
                  <span class="player-answer-name">{{ player.name }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Two-column: verdict left, scores right -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:2rem; align-items:start;">
            <!-- Left: verdict -->
            <div>
              <h3 style="margin-bottom:1rem; font-size:1rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-muted);">Verdict</h3>
              <div v-if="!answerRevealed" style="display:flex; flex-direction:column; gap:0.75rem;">
                <div class="card" style="display:flex; align-items:center; gap:1rem; padding:1.25rem;">
                  <span style="font-size:2rem;">👍</span>
                  <span style="font-weight:700; font-size:1.3rem; flex:1;">Agree</span>
                </div>
                <div class="card" style="display:flex; align-items:center; gap:1rem; padding:1.25rem;">
                  <span style="font-size:2rem;">👎</span>
                  <span style="font-weight:700; font-size:1.3rem; flex:1;">Disagree</span>
                </div>
              </div>
              <!-- Post-reveal verdict -->
              <div v-else-if="revealData?.defenseResult" style="display:flex; flex-direction:column; gap:0.75rem;">
                <div class="card"
                  :style="revealData.defenseResult.agreeCount > revealData.defenseResult.disagreeCount
                    ? 'border-color:var(--green);background:rgba(16,185,129,0.1)'
                    : revealData.defenseResult.agreeCount < revealData.defenseResult.disagreeCount ? 'opacity:0.45' : ''"
                  style="display:flex; align-items:center; gap:1rem; padding:1.25rem;"
                >
                  <span style="font-size:2rem;">👍</span>
                  <span style="font-weight:700; font-size:1.3rem; flex:1;">Agree</span>
                  <span style="font-weight:900; font-size:1.8rem;">{{ revealData.defenseResult.agreeCount }}</span>
                  <span v-if="revealData.defenseResult.agreeCount > revealData.defenseResult.disagreeCount" style="color:var(--green); font-size:1.4rem;">✓</span>
                </div>
                <div class="card"
                  :style="revealData.defenseResult.disagreeCount > revealData.defenseResult.agreeCount
                    ? 'border-color:var(--red,#ef4444);background:rgba(239,68,68,0.1)'
                    : revealData.defenseResult.disagreeCount < revealData.defenseResult.agreeCount ? 'opacity:0.45' : ''"
                  style="display:flex; align-items:center; gap:1rem; padding:1.25rem;"
                >
                  <span style="font-size:2rem;">👎</span>
                  <span style="font-weight:700; font-size:1.3rem; flex:1;">Disagree</span>
                  <span style="font-weight:900; font-size:1.8rem;">{{ revealData.defenseResult.disagreeCount }}</span>
                  <span v-if="revealData.defenseResult.disagreeCount > revealData.defenseResult.agreeCount" style="color:var(--red,#ef4444); font-size:1.4rem;">✓</span>
                </div>
                <!-- Winner banner -->
                <div class="card" :style="revealData.defenseResult.defenderWon
                    ? 'border-color:var(--green);background:rgba(16,185,129,0.12)'
                    : 'border-color:rgba(239,68,68,0.5);background:rgba(239,68,68,0.08)'"
                  style="padding:1rem 1.25rem; margin-top:0.25rem;"
                >
                  <p style="font-weight:800; font-size:1.1rem; line-height:1.4;">
                    <span v-if="revealData.defenseResult.defenderWon">
                      🏆 The crowd agreed! <strong>{{ players.find((p:any) => p.id === revealData.defensePlayerId)?.name }}</strong> wins the room and earns <strong style="color:var(--green);">+200 pts</strong>!
                    </span>
                    <span v-else-if="revealData.defenseResult.agreeCount === revealData.defenseResult.disagreeCount">
                      🤝 It's a tie! <strong>{{ players.find((p:any) => p.id === revealData.defensePlayerId)?.name }}</strong> still earns <strong style="color:var(--green);">+200 pts</strong> for defending.
                    </span>
                    <span v-else>
                      🔥 The crowd wasn't convinced! But <strong>{{ players.find((p:any) => p.id === revealData.defensePlayerId)?.name }}</strong> still earns <strong style="color:var(--green);">+200 pts</strong> for trying.
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <!-- Right: scores -->
            <div>
              <h3 style="margin-bottom:1rem; font-size:1rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-muted);">Scores</h3>
              <div v-if="runningScores.length" class="leaderboard">
                <div v-for="(s,i) in runningScores" :key="s.id" class="leaderboard-row" style="padding:0.85rem 1.25rem;">
                  <div class="lb-rank" style="font-size:1.3rem; min-width:2.5rem;">{{ i + 1 }}</div>
                  <div class="lb-name" style="font-size:1.2rem;">{{ s.name }}</div>
                  <div class="lb-score" style="font-size:1.3rem;">{{ s.score }}</div>
                </div>
              </div>
              <div v-else class="card" style="text-align:center; padding:2rem; color:var(--text-dim);">
                <p style="font-size:1rem;">Scores appear after the first reveal</p>
              </div>
            </div>
          </div>
        </template>

        <!-- ── NORMAL QUESTION ─────────────────────────────────────────────── -->
        <template v-else>
          <!-- The question -->
          <div class="card card--glow owl-question-row" style="margin-bottom:2rem; padding:2.5rem;">
            <OwlMascot size="xl" :mood="answerRevealed ? 'celebrate' : 'thinking'" />
            <div class="owl-question-body">
              <p class="owl-question-text">{{ currentQuestion.prompt }}</p>
              <div v-if="!answerRevealed" style="margin-top:1.5rem;">
                <div class="flex-between" style="margin-bottom:0.6rem;">
                  <span class="text-muted" style="font-size:1rem; text-transform:uppercase; letter-spacing:0.08em; font-weight:700;">Answers in</span>
                  <span style="font-weight:800; font-size:1.4rem; color:var(--cyan);">{{ answerCount }} / {{ activePlayers.length }}</span>
                </div>
                <div class="progress-bar" style="height:10px; margin-bottom:1rem;">
                  <div class="progress-bar__fill"
                    :style="{width: activePlayers.length > 0 ? (answerCount/activePlayers.length*100)+'%' : '0%'}">
                  </div>
                </div>
                <div class="player-answer-grid">
                  <div
                    v-for="player in activePlayers"
                    :key="player.id"
                    class="player-answer-chip host-answer-chip"
                    :class="answeredPlayerIds.includes(player.id) ? 'answered' : 'waiting'"
                  >
                    <span class="player-answer-icon">{{ answeredPlayerIds.includes(player.id) ? '✓' : '…' }}</span>
                    <span class="player-answer-name">{{ player.name }}</span>
                  </div>
                </div>
              </div>
              <div v-else style="margin-top:1.25rem;">
                <span class="badge badge--green" style="font-size:1.1rem; padding:0.5rem 1.25rem;">✓ All answered!</span>
              </div>
            </div>
          </div>

          <!-- Two-column: answers left, scores right -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:2rem; align-items:start;">
            <!-- Left: answer options -->
            <div>
              <h3 style="margin-bottom:1rem; font-size:1rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-muted);">Answers</h3>
              <div style="display:flex; flex-direction:column; gap:0.75rem;">
                <div
                  v-for="opt in currentQuestion.options"
                  :key="opt.id"
                  class="card"
                  :style="answerRevealed ? (opt.id === currentQuestion.correctAnswerId
                    ? 'border-color:var(--green);background:rgba(16,185,129,0.1)'
                    : 'opacity:0.4') : ''"
                  style="display:flex; align-items:center; gap:1rem; padding:1rem 1.25rem;"
                >
                  <img v-if="opt.imageUrl" :src="opt.imageUrl"
                    style="width:56px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0;"/>
                  <span style="font-weight:700; font-size:1.2rem; flex:1;">{{ opt.label }}</span>
                  <span v-if="answerRevealed && opt.id === currentQuestion.correctAnswerId"
                    style="color:var(--green); font-size:1.4rem;">✓</span>
                </div>
              </div>

              <!-- Reveal explanation -->
              <div v-if="answerRevealed && revealData" class="card" style="margin-top:1rem; border-color:var(--green); padding:1.25rem;">
                <p style="font-weight:700; font-size:1.2rem; line-height:1.3;">{{ revealData.explanation }}</p>
                <div v-if="revealData.correctPlayers?.length" style="margin-top:0.75rem;">
                  <span class="text-muted" style="font-size:0.95rem;">Got it right: </span>
                  <strong style="font-size:1rem;">{{ revealData.correctPlayers.map((id:string) => players.find(p=>p.id===id)?.name || id).join(', ') }}</strong>
                </div>
                <div v-if="revealData.mysteryBonusAwarded && revealData.subjectPlayerId" style="margin-top:0.85rem; padding:0.6rem 0.9rem; background:rgba(168,85,247,0.15); border:1px solid rgba(168,85,247,0.4); border-radius:10px; display:flex; align-items:center; gap:0.6rem;">
                  <span style="font-size:1.3rem;">🎭</span>
                  <span style="font-size:0.95rem;"><strong>{{ players.find(p => p.id === revealData.subjectPlayerId)?.name || 'Unknown' }}</strong> fooled most players and earns <strong style="color:#a855f7;">+150 mystery bonus!</strong></span>
                </div>
              </div>
            </div>

            <!-- Right: scores -->
            <div>
              <h3 style="margin-bottom:1rem; font-size:1rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-muted);">Scores</h3>
              <div v-if="runningScores.length" class="leaderboard">
                <div v-for="(s,i) in runningScores" :key="s.id" class="leaderboard-row" style="padding:0.85rem 1.25rem;">
                  <div class="lb-rank" style="font-size:1.3rem; min-width:2.5rem;">{{ i + 1 }}</div>
                  <div class="lb-name" style="font-size:1.2rem;">{{ s.name }}</div>
                  <div class="lb-score" style="font-size:1.3rem;">{{ s.score }}</div>
                </div>
              </div>
              <div v-else class="card" style="text-align:center; padding:2rem; color:var(--text-dim);">
                <p style="font-size:1rem;">Scores appear after the first reveal</p>
              </div>
            </div>
          </div>
        </template>

      </div>
    </div>

    <!-- ── RESULTS ────────────────────────────────────────────────────────── -->
    <div v-if="phase === 'results'" style="max-width:1000px;margin:0 auto;">
      <div class="text-center" style="margin-bottom:2.5rem;">
        <div style="display:flex; justify-content:center; margin-bottom:1.25rem;">
          <OwlMascot size="lg" mood="celebrate" message="The rankings have been judged!" />
        </div>
        <h1>Final Results</h1>
        <p class="text-muted mt-sm" style="font-size:1.2rem;">{{ listName }} · Social Deduction Scores</p>
      </div>

      <div class="leaderboard" style="margin-bottom:2.5rem;">
        <div v-for="(r,i) in finalResults" :key="r.id" class="leaderboard-row" style="padding:1.1rem 1.5rem;">
          <div class="lb-rank" style="font-size:2rem; min-width:3rem;">{{ rankEmoji(i) }}</div>
          <div class="lb-name" style="font-size:1.4rem;">{{ r.name }}</div>
          <div class="lb-bar">
            <div class="progress-bar" style="height:10px;">
              <div class="progress-bar__fill"
                :style="{width: finalResults[0]?.socialScore > 0 ? (r.socialScore/finalResults[0].socialScore*100)+'%' : '0%'}">
              </div>
            </div>
          </div>
          <div class="lb-score" style="font-size:1.5rem;">{{ r.socialScore }} pts</div>
        </div>
      </div>

      <!-- Full rankings comparison -->
      <div v-if="stats?.playerRankings?.length" class="card" style="margin-bottom:2rem;">
        <h2 style="margin-bottom:1.25rem;">How Everyone Ranked</h2>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:1rem;">
            <thead>
              <tr>
                <th style="text-align:left;padding:0.75rem;color:var(--text-muted);border-bottom:1px solid var(--border); font-size:1rem;">Slot</th>
                <th v-for="pr in stats.playerRankings" :key="pr.id"
                  style="padding:0.75rem;color:var(--cyan);border-bottom:1px solid var(--border); font-size:1rem;">
                  {{ pr.name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="slot in allItems.length" :key="slot">
                <td style="padding:0.75rem;color:var(--text-muted);font-weight:700; font-size:1rem;">#{{ slot }}</td>
                <td v-for="pr in stats.playerRankings" :key="pr.id" style="padding:0.75rem;text-align:center; font-size:1rem;">
                  <template v-if="pr.placements[slot]">
                    <img v-if="pr.placements[slot].imageUrl" :src="pr.placements[slot].imageUrl"
                      style="width:24px;height:24px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:6px;"/>
                    {{ pr.placements[slot].text }}
                  </template>
                  <span v-else style="color:var(--text-dim);">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="flex gap-md" style="justify-content:center;">
        <NuxtLink to="/" class="btn btn--primary btn--lg" style="font-size:1.2rem; padding:1.1rem 2.5rem;">Play Again</NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Ranking phase: fit everything in 1080p ──────────────────────────── */
.ranking-screen {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 3rem); /* account for page padding */
  max-width: 1800px;
  margin: 0 auto;
  overflow: hidden;
}

.ranking-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}

.ranking-topbar__progress {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.ranking-complete-card {
  margin: auto;
  max-width: 600px;
}

.ranking-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  flex: 1;
  min-height: 0; /* allow children to scroll */
}

/* LEFT column */
.ranking-left {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  position: relative;
}

.ranking-video-wrap {
  /* Fixed height that works well at 1080p alongside owl + placed bar */
  height: 480px;
  flex-shrink: 0;
  border-radius: 16px;
  overflow: hidden;
  background: #000;
  position: relative;
}

/* Make YouTubePlayer fill its container */
.ranking-video-wrap :deep(.yt-player-wrap) {
  height: 100% !important;
  border-radius: 0;
}

.ranking-video-wrap :deep(iframe) {
  width: 100% !important;
  height: 100% !important;
  border: none;
  display: block;
}

.ranking-item-img {
  height: 380px;
  flex-shrink: 0;
  width: 100%;
  object-fit: cover;
  border-radius: 16px;
  display: block;
}

.ranking-owl-row {
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.ranking-placed-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  margin-top: auto;
}

/* RIGHT column */
.ranking-right {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.ranking-right__heading {
  color: var(--text-muted);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.6rem;
  flex-shrink: 0;
}

.ranking-grid--fit {
  flex: 1;
  overflow-y: auto;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)) !important;
  align-content: start;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.ranking-grid--fit .mini-slot {
  font-size: 0.75rem;
  padding: 0.3rem 0.5rem;
  margin-bottom: 0.25rem;
}

.ranking-grid--fit .mini-slot__rank {
  font-size: 0.75rem;
  min-width: 1.5rem;
}

.ranking-grid--fit .player-ranking__name {
  font-size: 0.85rem;
}

/* Next-item countdown overlay */
.next-item-countdown {
  position: absolute;
  inset: 0;
  background: rgba(10, 10, 20, 0.82);
  backdrop-filter: blur(6px);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  z-index: 20;
}

.next-item-countdown__label {
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.next-item-countdown__number {
  font-size: 7rem;
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(135deg, var(--accent), #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: countdown-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes countdown-pop {
  from { transform: scale(0.5); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}

.countdown-fade-enter-active,
.countdown-fade-leave-active {
  transition: opacity 0.25s ease;
}
.countdown-fade-enter-from,
.countdown-fade-leave-to {
  opacity: 0;
}

/* Defense round */
.defense-hero-card {
  border-color: rgba(168, 85, 247, 0.4);
  background: rgba(168, 85, 247, 0.05);
}

.defense-hero-top {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.defense-hero-body {
  flex: 1;
}

.defense-timer {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.4);
  border-radius: 10px;
  padding: 0.5rem 1rem;
}

.defense-timer--urgent {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.5);
  animation: pulseGlow 1s ease-in-out infinite;
}

.defense-timer__icon {
  font-size: 1.2rem;
}

.defense-timer__time {
  font-size: 1.8rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.defense-timer--urgent .defense-timer__time {
  color: #ef4444;
}

.defense-timer__label {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.defense-callout {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: rgba(168, 85, 247, 0.12);
  border: 1.5px solid rgba(168, 85, 247, 0.5);
  border-radius: 12px;
  margin-bottom: 0.5rem;
}

.defense-callout__icon {
  font-size: 2rem;
  flex-shrink: 0;
  line-height: 1;
}

.defense-callout__name {
  font-size: 1.3rem;
  font-weight: 900;
  color: #a855f7;
  margin-bottom: 0.3rem;
}

.defense-callout__desc {
  font-size: 0.95rem;
  color: var(--text-muted);
  line-height: 1.5;
}
</style>
