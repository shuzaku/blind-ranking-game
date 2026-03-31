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
const answerRevealed = ref(false)
const revealData = ref<any>(null)
const runningScores = ref<Array<{ id: string; name: string; score: number }>>([])
const showStatsFirst = ref(false)

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
  })

  $socket.on('placement-update', (data: any) => {
    placedCount.value = data.placedCount
    recentPlacements.value = [{ name: data.playerName, slot: data.slot }, ...recentPlacements.value].slice(0, 8)
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
    showStatsFirst.value = false
    currentQuestion.value = data.question
    questionNumber.value = data.questionNumber
    totalQuestions.value = data.totalQuestions
    answerRevealed.value = false
    answerCount.value = 0
    revealData.value = null
  })

  $socket.on('social-answer-count', (data: any) => {
    answerCount.value = data.count
  })

  $socket.on('social-answer-revealed', (data: any) => {
    answerRevealed.value = true
    revealData.value = data
    runningScores.value = data.runningScores
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
  ['connect','host-joined','player-joined','player-left','game-started','item-revealed',
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

// ── Computed ──────────────────────────────────────────────────────────────────
const activePlayers = computed(() => players.value.filter(p => p.connected))
const allPlaced = computed(() => placedCount.value >= activePlayers.value.length && activePlayers.value.length > 0)
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
  <div class="page" style="min-height:100vh; padding:1.25rem;">

    <div v-if="errorMsg" class="toast toast--error">{{ errorMsg }}</div>

    <!-- Connecting -->
    <div v-if="phase === 'connecting'" class="flex-center" style="height:80vh;flex-direction:column;gap:1rem;">
      <div class="spinner" style="width:48px;height:48px;border-width:4px;"></div>
      <p class="text-muted">Connecting...</p>
    </div>

    <!-- ── LOBBY ──────────────────────────────────────────────────────────── -->
    <div v-if="phase === 'lobby'" class="container--wide">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;align-items:start;">

        <div>
          <div class="code-card">
            <p style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-muted);margin-bottom:0.4rem;">Players join at</p>
            <p style="font-size:0.9rem;color:var(--cyan);margin-bottom:0.75rem;">{{ joinUrl }}</p>
            <div class="lobby-code">{{ code }}</div>
          </div>

          <div class="card mt-lg">
            <h3>{{ listName }}</h3>
            <p class="text-muted mt-sm" style="font-size:0.9rem;">{{ totalItems }} items · Players rank from their own perspective</p>
            <div class="divider"></div>
            <p class="text-muted" style="font-size:0.85rem;margin-bottom:1rem;">
              Items appear one at a time. Each player places them in personal slots — no correct answer!
              Afterwards, a social deduction round reveals who ranked what.
            </p>
            <button
              class="btn btn--primary btn--lg btn--block"
              :disabled="activePlayers.length === 0"
              @click="startGame"
            >
              {{ activePlayers.length === 0 ? 'Waiting for players...' : `Start with ${activePlayers.length} player${activePlayers.length !== 1 ? 's' : ''}` }}
            </button>
          </div>
        </div>

        <div class="card">
          <h2 style="margin-bottom:1rem;">
            Players
            <span class="badge badge--green" style="margin-left:0.5rem;">{{ activePlayers.length }}</span>
          </h2>
          <div v-if="players.length === 0" class="text-center" style="padding:2rem;color:var(--text-dim);">
            <div class="waiting-dots"><span>●</span><span>●</span><span>●</span></div>
            <p class="mt-sm">Waiting for players to join...</p>
          </div>
          <div v-else class="player-grid">
            <div v-for="p in players" :key="p.id" class="player-chip" :class="{disconnected:!p.connected}">
              <div class="player-dot"></div>
              {{ p.name }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── RANKING PHASE ─────────────────────────────────────────────────── -->
    <div v-if="phase === 'ranking'" class="container--wide">
      <div class="flex-between" style="margin-bottom:1rem;">
        <div class="flex gap-md" style="align-items:center;">
          <span class="badge badge--cyan">{{ code }}</span>
          <span class="text-muted" style="font-size:0.9rem;">{{ listName }}</span>
        </div>
        <span style="font-weight:700;">{{ currentItemNumber }} / {{ totalItems }}</span>
      </div>

      <div class="progress-bar" style="margin-bottom:1.5rem;">
        <div class="progress-bar__fill" :style="{ width: progressPct + '%' }"></div>
      </div>

      <div style="display:grid;grid-template-columns:300px 1fr;gap:1.5rem;align-items:start;">

        <!-- Left -->
        <div>
          <div v-if="rankingComplete" class="card card--glow text-center" style="margin-bottom:1rem;">
            <div style="font-size:2rem;margin-bottom:0.5rem;">🎉</div>
            <h3>All items ranked!</h3>
            <p class="text-muted mt-sm" style="font-size:0.85rem;">Ready for social deduction?</p>
            <button class="btn btn--primary btn--lg btn--block mt-md" @click="goToSocial">
              Start Social Round →
            </button>
          </div>

          <div v-else-if="currentItem" class="item-card">
            <div class="item-number">Item {{ currentItemNumber }} of {{ totalItems }}</div>
            <img v-if="currentItem.imageUrl" :src="currentItem.imageUrl" class="item-card__image" />
            <div class="item-card__text">{{ currentItem.text }}</div>
          </div>

          <div v-if="!rankingComplete" class="card mt-md">
            <div class="flex-between" style="margin-bottom:0.5rem;">
              <span class="text-muted" style="font-size:0.85rem;">PLACED</span>
              <span style="font-weight:800;">{{ placedCount }} / {{ activePlayers.length }}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-bar__fill"
                :style="{width: activePlayers.length > 0 ? (placedCount/activePlayers.length*100)+'%':'0%',
                         background: allPlaced ? 'var(--green)' : undefined}">
              </div>
            </div>
            <div v-if="recentPlacements.length" style="margin-top:0.75rem;display:flex;flex-direction:column;gap:0.25rem;">
              <div v-for="(p,i) in recentPlacements.slice(0,5)" :key="i" style="font-size:0.8rem;color:var(--text-muted);">
                Someone placed at <strong style="color:var(--text);">#{{ p.slot }}</strong>
              </div>
            </div>
          </div>

          <button v-if="!rankingComplete" class="btn btn--ghost btn--block mt-md" @click="skipReveal">
            Skip → Reveal Next
          </button>
        </div>

        <!-- Right: Player rankings grid -->
        <div>
          <h3 style="margin-bottom:1rem;color:var(--text-muted);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.08em;">
            Everyone's Rankings
          </h3>
          <div class="rankings-grid">
            <div v-for="(player, playerIndex) in activePlayers" :key="player.id" class="player-ranking">
              <div class="player-ranking__name">
                <div class="player-dot" style="width:6px;height:6px;"></div>
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
                    <span style="font-size:0.72rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                      {{ playerRankings[player.id][slot]?.text }}
                    </span>
                  </template>
                  <span v-else style="color:var(--text-dim);font-size:0.72rem;">—</span>
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
      <div v-if="showStatsFirst && stats" style="max-width:900px;margin:0 auto;">
        <div class="text-center" style="margin-bottom:2rem;">
          <div style="font-size:2.5rem;margin-bottom:0.5rem;">📊</div>
          <h1>Rankings Complete!</h1>
          <p class="text-muted mt-sm">Here's how the group ranked everything...</p>
        </div>

        <!-- Item bars -->
        <div class="card" style="margin-bottom:1.5rem;">
          <h3 style="margin-bottom:1.25rem;">Group Rankings</h3>
          <div style="display:flex;flex-direction:column;gap:1rem;">
            <div v-for="(itemStat, i) in [...stats.items].sort((a:any,b:any)=>a.avgRank-b.avgRank)" :key="i">
              <div class="flex-between" style="margin-bottom:0.3rem;">
                <div class="flex gap-sm" style="align-items:center;">
                  <img v-if="itemStat.item.imageUrl" :src="itemStat.item.imageUrl"
                    style="width:28px;height:28px;object-fit:cover;border-radius:6px;"/>
                  <span style="font-weight:700;">{{ itemStat.item.text }}</span>
                </div>
                <span class="text-muted" style="font-size:0.85rem;">avg #{{ itemStat.avgRank }}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-bar__fill" :style="{width: ((totalItems - itemStat.avgRank + 1) / totalItems * 100) + '%'}"></div>
              </div>
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.3rem;">
                <span v-if="itemStat.rankedFirstBy.length" style="font-size:0.75rem;color:var(--green);">
                  🥇 {{ itemStat.rankedFirstBy.join(', ') }}
                </span>
                <span v-if="itemStat.rankedLastBy.length" style="font-size:0.75rem;color:var(--red);">
                  💀 {{ itemStat.rankedLastBy.join(', ') }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Hot takes -->
        <div v-if="stats.players?.some((p:any)=>p.hotTakes?.length)" class="card" style="margin-bottom:1.5rem;">
          <h3 style="margin-bottom:1rem;">🌶️ Hot Takes</h3>
          <div style="display:flex;flex-direction:column;gap:0.75rem;">
            <div v-for="pStat in stats.players" :key="pStat.playerId">
              <div v-for="take in pStat.hotTakes" :key="take.item.text" class="card" style="padding:0.75rem;background:var(--surface);">
                <span style="color:var(--cyan);font-weight:700;">{{ pStat.playerName }}</span>
                ranked <strong>"{{ take.item.text }}"</strong> at
                <span style="color:var(--accent);font-weight:700;">#{{ take.playerRank }}</span>
                while the group average was
                <span style="color:var(--text-muted);">#{{ take.groupAvg }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card text-center" style="margin-bottom:1.5rem;" v-if="stats.mostControversial">
          <p class="text-muted" style="font-size:0.85rem;margin-bottom:0.5rem;">Most Controversial</p>
          <h2>🔥 "{{ stats.mostControversial.item.text }}"</h2>
          <p class="text-muted mt-sm" style="font-size:0.9rem;">The group couldn't agree on this one!</p>
        </div>

        <div class="text-center">
          <p class="text-muted" style="font-size:0.9rem;margin-bottom:1rem;">Ready for the social deduction round? ({{ totalQuestions }} questions)</p>
          <button class="btn btn--primary btn--lg" @click="showStatsFirst = false">
            Start Social Round →
          </button>
        </div>
      </div>

      <!-- Social question display -->
      <div v-else-if="currentQuestion" style="max-width:800px;margin:0 auto;">
        <div class="flex-between" style="margin-bottom:1.5rem;">
          <div class="flex gap-md" style="align-items:center;">
            <span class="badge badge--cyan">{{ code }}</span>
            <span class="badge badge--yellow">{{ currentQuestion.category }}</span>
          </div>
          <span class="text-muted">Question {{ questionNumber }} / {{ totalQuestions }}</span>
        </div>

        <div class="progress-bar" style="margin-bottom:2rem;">
          <div class="progress-bar__fill" :style="{width: (questionNumber/totalQuestions*100)+'%'}"></div>
        </div>

        <!-- The question -->
        <div class="card card--glow text-center" style="margin-bottom:1.5rem;padding:2rem;">
          <h2 style="font-size:clamp(1.3rem,3vw,2rem);line-height:1.3;">{{ currentQuestion.prompt }}</h2>
          <div v-if="!answerRevealed" style="margin-top:1.5rem;">
            <div class="flex-between">
              <span class="text-muted">Answers in:</span>
              <span style="font-weight:800;color:var(--cyan);">{{ answerCount }} / {{ activePlayers.length }}</span>
            </div>
            <div class="progress-bar mt-sm">
              <div class="progress-bar__fill"
                :style="{width: activePlayers.length > 0 ? (answerCount/activePlayers.length*100)+'%' : '0%'}">
              </div>
            </div>
          </div>
        </div>

        <!-- Options grid (shown to host as reference) -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.75rem;margin-bottom:1.5rem;">
          <div
            v-for="opt in currentQuestion.options"
            :key="opt.id"
            class="card"
            :style="answerRevealed ? (opt.id === currentQuestion.correctAnswerId
              ? 'border-color:var(--green);background:rgba(16,185,129,0.1)'
              : 'opacity:0.4') : ''"
            style="text-align:center;padding:1rem;"
          >
            <img v-if="opt.imageUrl" :src="opt.imageUrl"
              style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-bottom:0.5rem;"/>
            <div style="font-weight:700;">{{ opt.label }}</div>
            <div v-if="answerRevealed && revealData" style="margin-top:0.5rem;font-size:0.8rem;">
              {{ Object.entries(revealData.answererScores || {}).filter(([,v]:any)=>v>0 && revealData.correctPlayers?.includes('placeholder')).length }}
            </div>
          </div>
        </div>

        <!-- Reveal / explanation -->
        <div v-if="answerRevealed && revealData" class="card" style="margin-bottom:1.5rem;text-align:center;border-color:var(--green);">
          <div style="font-size:1.5rem;margin-bottom:0.5rem;">✅</div>
          <p style="font-weight:700;font-size:1.1rem;">{{ revealData.explanation }}</p>
          <div v-if="revealData.correctPlayers?.length" style="margin-top:0.75rem;">
            <span class="text-muted" style="font-size:0.85rem;">Got it right: </span>
            <strong>{{ revealData.correctPlayers.map((id:string) => players.find(p=>p.id===id)?.name || id).join(', ') }}</strong>
          </div>
        </div>

        <!-- Running scores during social -->
        <div v-if="runningScores.length" class="card" style="margin-bottom:1.5rem;">
          <h3 style="margin-bottom:0.75rem;">Scores so far</h3>
          <div class="leaderboard">
            <div v-for="(s,i) in runningScores" :key="s.id" class="leaderboard-row" style="padding:0.6rem 1rem;">
              <div class="lb-rank" style="font-size:1rem;">{{ i+1 }}</div>
              <div class="lb-name">{{ s.name }}</div>
              <div class="lb-score">{{ s.score }}</div>
            </div>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="text-center flex gap-md" style="justify-content:center;">
          <button v-if="!answerRevealed" class="btn btn--primary btn--lg" @click="revealAnswer">
            Reveal Answer
          </button>
          <button v-else class="btn btn--primary btn--lg" @click="nextQuestion">
            {{ isLastQuestion ? 'See Final Results →' : 'Next Question →' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── RESULTS ────────────────────────────────────────────────────────── -->
    <div v-if="phase === 'results'" style="max-width:900px;margin:0 auto;">
      <div class="text-center" style="margin-bottom:2rem;">
        <div style="font-size:3rem;margin-bottom:0.5rem;">🏆</div>
        <h1>Final Results</h1>
        <p class="text-muted mt-sm">{{ listName }} · Social Deduction Scores</p>
      </div>

      <div class="leaderboard" style="margin-bottom:2rem;">
        <div v-for="(r,i) in finalResults" :key="r.id" class="leaderboard-row">
          <div class="lb-rank">{{ rankEmoji(i) }}</div>
          <div class="lb-name">{{ r.name }}</div>
          <div class="lb-bar">
            <div class="progress-bar">
              <div class="progress-bar__fill"
                :style="{width: finalResults[0]?.socialScore > 0 ? (r.socialScore/finalResults[0].socialScore*100)+'%' : '0%'}">
              </div>
            </div>
          </div>
          <div class="lb-score">{{ r.socialScore }} pts</div>
        </div>
      </div>

      <!-- Full rankings comparison -->
      <div v-if="stats?.playerRankings?.length" class="card" style="margin-bottom:1.5rem;">
        <h3 style="margin-bottom:1rem;">How Everyone Ranked</h3>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
            <thead>
              <tr>
                <th style="text-align:left;padding:0.5rem;color:var(--text-muted);border-bottom:1px solid var(--border);">Slot</th>
                <th v-for="pr in stats.playerRankings" :key="pr.id"
                  style="padding:0.5rem;color:var(--cyan);border-bottom:1px solid var(--border);">
                  {{ pr.name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="slot in allItems.length" :key="slot">
                <td style="padding:0.5rem;color:var(--text-muted);font-weight:700;">#{{ slot }}</td>
                <td v-for="pr in stats.playerRankings" :key="pr.id" style="padding:0.5rem;text-align:center;">
                  <template v-if="pr.placements[slot]">
                    <img v-if="pr.placements[slot].imageUrl" :src="pr.placements[slot].imageUrl"
                      style="width:20px;height:20px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:4px;"/>
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
        <NuxtLink to="/" class="btn btn--primary btn--lg">Play Again</NuxtLink>
      </div>
    </div>
  </div>
</template>
