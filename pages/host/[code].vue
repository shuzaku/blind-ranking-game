<script setup lang="ts">
const route = useRoute()
const { $socket } = useNuxtApp()
const code = (route.params.code as string).toUpperCase()

// ── State ─────────────────────────────────────────────────────────────────────
type Phase = 'connecting' | 'lobby' | 'ranking' | 'social' | 'results'
const phase = ref<Phase>('connecting')
const listName = ref('')
const totalItems = ref(0)
const players = ref<Array<{ id: string; name: string; connected: boolean }>>([])
const errorMsg = ref('')

// Ranking phase
const currentItem = ref<{ text: string; imageUrl: string } | null>(null)
const currentItemNumber = ref(0)
const placedCount = ref(0)
const recentPlacements = ref<Array<{ name: string; slot: number }>>([])
const playerRankings = ref<Record<string, Record<number, { text: string; imageUrl: string }>>>({})
const rankingComplete = ref(false)

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

// Auto-advance countdown
const autoAdvanceCountdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

function startAutoAdvance() {
  autoAdvanceCountdown.value = 10
  countdownTimer = setInterval(() => {
    autoAdvanceCountdown.value--
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
  })

  $socket.on('player-left', (data: any) => { players.value = data.players })

  $socket.on('game-started', (data: any) => {
    totalItems.value = data.totalItems
    phase.value = 'ranking'
    placedCount.value = 0
    rankingComplete.value = false
    playerRankings.value = {}
    for (const p of players.value) playerRankings.value[p.id] = {}
  })

  $socket.on('item-revealed', (data: any) => {
    currentItem.value = data.item
    currentItemNumber.value = data.itemNumber
    placedCount.value = 0
    recentPlacements.value = []
    lastPlacedNames.value = []
    currentQuip.value = ''
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
  })

  $socket.on('round-complete', (data: any) => {
    if (data.isLastItem) rankingComplete.value = true
  })

  $socket.on('social-started', (data: any) => {
    stats.value = data.stats
    totalQuestions.value = data.totalQuestions
    phase.value = 'social'
    showStatsFirst.value = true
    answerRevealed.value = false
    answerCount.value = 0
  })

  $socket.on('social-question', (data: any) => {
    cancelAutoAdvance()
    showStatsFirst.value = false
    currentQuestion.value = data.question
    questionNumber.value = data.questionNumber
    totalQuestions.value = data.totalQuestions
    answerRevealed.value = false
    answerCount.value = 0
    answeredPlayerIds.value = []
    revealData.value = null
  })

  $socket.on('social-answer-count', (data: any) => {
    answerCount.value = data.count
    answeredPlayerIds.value = data.answeredPlayerIds ?? []
  })

  $socket.on('social-answer-revealed', (data: any) => {
    answerRevealed.value = true
    revealData.value = data
    runningScores.value = data.runningScores
    startAutoAdvance()
  })

  $socket.on('game-over', (data: any) => {
    phase.value = 'results'
    finalResults.value = data.results
    allItems.value = data.items
    stats.value = data.stats
  })

  $socket.on('error', (data: any) => {
    errorMsg.value = data.message
    setTimeout(() => { errorMsg.value = '' }, 4000)
  })
})

onBeforeUnmount(() => {
  cancelAutoAdvance()
  ;['connect','host-joined','player-joined','player-left','game-started','item-revealed',
   'placement-update','round-complete','social-started','social-question','social-answer-count',
   'social-answer-revealed','game-over','error'].forEach(e => $socket.off(e))
  $socket.disconnect()
})

// ── Actions ───────────────────────────────────────────────────────────────────
const startGame = () => $socket.emit('start-game', { code })
const skipReveal = () => $socket.emit('reveal-next', { code })
const goToSocial = () => $socket.emit('start-social', { code })
const revealAnswer = () => $socket.emit('reveal-answer', { code })
const nextQuestion = () => $socket.emit('next-question', { code })

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
  <div class="page host-screen" style="min-height:100vh; padding:1.5rem 2rem;">

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
    <div v-if="phase === 'ranking'" class="container--wide">
      <div class="flex-between" style="margin-bottom:1.25rem;">
        <div class="flex gap-md" style="align-items:center;">
          <span class="badge badge--cyan" style="font-size:1rem; padding:0.4rem 1rem; letter-spacing:0.15em;">{{ code }}</span>
          <span class="text-muted" style="font-size:1.2rem; font-weight:600;">{{ listName }}</span>
        </div>
        <span style="font-weight:800; font-size:1.4rem;">{{ currentItemNumber }} / {{ totalItems }}</span>
      </div>

      <div class="progress-bar" style="height:10px; margin-bottom:2rem;">
        <div class="progress-bar__fill" :style="{ width: progressPct + '%' }"></div>
      </div>

      <!-- Owl item announcement — full width, centered -->
      <div v-if="rankingComplete" class="card card--glow text-center" style="margin-bottom:2rem; padding:3rem;">
        <div style="font-size:3rem;margin-bottom:1rem;">🎉</div>
        <h2 style="font-size:2.2rem;">All items ranked!</h2>
        <p class="text-muted mt-sm" style="font-size:1.2rem;">Ready for social deduction?</p>
        <button class="btn btn--primary btn--lg mt-lg" style="font-size:1.3rem; padding:1.1rem 2.5rem;" @click="goToSocial">
          Start Social Round →
        </button>
      </div>

      <div v-else-if="currentItem" style="margin-bottom:2rem;">
        <img v-if="currentItem.imageUrl" :src="currentItem.imageUrl"
          style="display:block;margin:0 auto;width:320px;height:320px;object-fit:cover;border-radius:20px;margin-bottom:1.25rem;" />
        <div style="display:flex; justify-content:center; margin-bottom:1.25rem;">
          <OwlMascot
            size="xl"
            :mood="allPlaced ? 'celebrate' : 'excited'"
            :message="allPlaced ? currentQuip : currentItem.text"
          />
        </div>
      </div>

      <!-- Placed count + skip -->
      <div v-if="!rankingComplete" style="display:flex; gap:1.25rem; align-items:center; margin-bottom:2rem;">
        <div class="card" style="flex:1; padding:1.25rem;">
          <div class="flex-between" style="margin-bottom:0.6rem;">
            <span class="text-muted" style="font-size:1rem; text-transform:uppercase; letter-spacing:0.08em; font-weight:700;">Placed</span>
            <span style="font-weight:800; font-size:1.4rem;">{{ placedCount }} / {{ activePlayers.length }}</span>
          </div>
          <div class="progress-bar" style="height:10px;">
            <div class="progress-bar__fill"
              :style="{width: activePlayers.length > 0 ? (placedCount/activePlayers.length*100)+'%':'0%',
                       background: allPlaced ? 'var(--green)' : undefined}">
            </div>
          </div>
        </div>
        <button class="btn btn--ghost btn--lg" style="flex-shrink:0; font-size:1.1rem;" @click="skipReveal">
          Skip →
        </button>
      </div>

      <!-- Player rankings grid -->
      <div>
        <h3 style="margin-bottom:1rem;color:var(--text-muted);font-size:1rem;text-transform:uppercase;letter-spacing:0.08em;">
          Everyone's Rankings
        </h3>
        <div class="rankings-grid" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));">
          <div v-for="(player, playerIndex) in activePlayers" :key="player.id" class="player-ranking">
            <div class="player-ranking__name" style="font-size:1.05rem; margin-bottom:0.5rem;">
              <div class="player-dot" style="width:8px;height:8px;"></div>
              Player {{ playerIndex + 1 }}
            </div>
            <div v-for="slot in totalItems" :key="slot">
              <div class="mini-slot" :class="playerRankings[player.id]?.[slot] ? 'filled' : 'empty'" style="font-size:0.9rem; padding:0.45rem 0.7rem; margin-bottom:0.35rem;">
                <span class="mini-slot__rank" style="font-size:0.9rem; min-width:1.8rem;">#{{ slot }}</span>
                <template v-if="playerRankings[player.id]?.[slot]">
                  <img v-if="playerRankings[player.id][slot]?.imageUrl"
                    :src="playerRankings[player.id][slot]!.imageUrl"
                    style="width:20px;height:20px;object-fit:cover;border-radius:3px;flex-shrink:0;"
                  />
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    {{ playerRankings[player.id][slot]?.text }}
                  </span>
                </template>
                <span v-else style="color:var(--text-dim);">—</span>
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
