<script setup lang="ts">
const route = useRoute()
const { $socket } = useNuxtApp()
const { play } = useSound()
const code = (route.params.code as string).toUpperCase()

// ── State ─────────────────────────────────────────────────────────────────────
type Screen = 'join' | 'lobby' | 'ranking' | 'round-complete' | 'social-stats' | 'social-question' | 'social-waiting' | 'social-result' | 'results'
const screen = ref<Screen>('join')

const playerName = ref('')
const playerId = ref('')
const errorMsg = ref('')
const toastMsg = ref('')
const toastType = ref<'error' | 'success' | 'info'>('info')

// Lobby
const players = ref<Array<{ id: string; name: string; connected: boolean }>>([])
const totalItems = ref(0)

// Ranking phase
const currentItem = ref<{ text: string; imageUrl: string } | null>(null)
const currentItemNumber = ref(0)
const hasPlacedThisRound = ref(false)
const placements = ref<Record<number, { text: string; imageUrl: string }>>({})
const lastRoundIsLast = ref(false)

// Social phase
const socialStats = ref<any>(null)
const currentQuestion = ref<any>(null)
const questionNumber = ref(0)
const totalQuestions = ref(0)
const selectedAnswer = ref<string | null>(null)
const hasAnswered = ref(false)
const revealData = ref<any>(null)
const pointsEarned = ref(0)
const totalSocialScore = ref(0)

// Results
const finalResults = ref<any[]>([])
const allItems = ref<any[]>([])

// ── Socket ─────────────────────────────────────────────────────────────────────
onMounted(() => {
  $socket.connect()

  $socket.on('joined', (data: any) => {
    playerId.value = data.playerId
    players.value = data.players
    totalItems.value = data.totalItems
    screen.value = 'lobby'
    errorMsg.value = ''
    play('join')
  })

  $socket.on('player-joined', (data: any) => {
    players.value = data.players
    play('playerJoin')
  })
  $socket.on('player-left', (data: any) => {
    players.value = data.players
    play('pop')
  })

  $socket.on('game-started', (data: any) => {
    totalItems.value = data.totalItems
    screen.value = 'ranking'
    placements.value = {}
    hasPlacedThisRound.value = false
    currentItem.value = null
    lastRoundIsLast.value = false
    play('gameStart')
  })

  $socket.on('item-revealed', (data: any) => {
    currentItem.value = data.item
    currentItemNumber.value = data.itemNumber
    hasPlacedThisRound.value = false
    screen.value = 'ranking'
    showToast(`Item ${data.itemNumber} of ${data.totalItems}`, 'info')
    play('itemReveal')
  })

  $socket.on('placement-confirmed', (data: any) => {
    placements.value[data.slot] = data.item
    hasPlacedThisRound.value = true
    play('placement')
  })

  $socket.on('placement-error', (data: any) => {
    showToast(data.message, 'error')
    play('wrong')
  })

  $socket.on('round-complete', (data: any) => {
    lastRoundIsLast.value = data.isLastItem
    if (data.isLastItem) {
      screen.value = 'round-complete'
      play('roundComplete')
    } else {
      play('allPlaced')
    }
  })

  $socket.on('social-started', (data: any) => {
    socialStats.value = data.stats
    screen.value = 'social-stats'
    totalQuestions.value = data.totalQuestions
    totalSocialScore.value = 0
    play('socialStart')
  })

  $socket.on('social-question', (data: any) => {
    currentQuestion.value = data.question
    questionNumber.value = data.questionNumber
    totalQuestions.value = data.totalQuestions
    hasAnswered.value = false
    selectedAnswer.value = null
    revealData.value = null
    pointsEarned.value = 0
    screen.value = 'social-question'
    play('whoosh')
  })

  $socket.on('social-answer-accepted', () => {
    screen.value = 'social-waiting'
    play('chime')
  })

  $socket.on('social-answer-revealed', (data: any) => {
    revealData.value = data
    const myScore = data.scores?.[playerId.value] ?? 0
    pointsEarned.value = myScore
    totalSocialScore.value += myScore
    screen.value = 'social-result'
    // Play correct or wrong based on whether they got it right
    const gotIt = data.correctAnswer && selectedAnswer.value === currentQuestion.value?.correctAnswerId
    play(gotIt ? 'correct' : 'wrong')
  })

  $socket.on('game-over', (data: any) => {
    finalResults.value = data.results
    allItems.value = data.items
    socialStats.value = data.stats
    screen.value = 'results'
    play('fanfare')
  })

  $socket.on('error', (data: any) => {
    if (screen.value === 'join') { errorMsg.value = data.message }
    else { showToast(data.message, 'error') }
    play('pop')
  })
})

onBeforeUnmount(() => {
  ['joined','player-joined','player-left','game-started','item-revealed','placement-confirmed',
   'placement-error','round-complete','social-started','social-question','social-answer-accepted',
   'social-answer-revealed','game-over','error'].forEach(e => $socket.off(e))
  $socket.disconnect()
})

// ── Actions ───────────────────────────────────────────────────────────────────
function joinGame() {
  if (!playerName.value.trim()) {
    errorMsg.value = 'Enter your name'
    play('pop')
    return
  }
  errorMsg.value = ''
  play('whoosh')
  $socket.emit('player-join', { code, name: playerName.value.trim() })
}

function placeItem(slot: number) {
  if (hasPlacedThisRound.value) return
  if (placements.value[slot] !== undefined) return
  if (!currentItem.value) return
  play('click')
  $socket.emit('place-item', { code, slot })
}

function submitSocialAnswer(answerId: string) {
  if (hasAnswered.value) return
  selectedAnswer.value = answerId
  hasAnswered.value = true
  play('whoosh')
  $socket.emit('social-answer', { code, answerId })
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const progressPct = computed(() =>
  totalItems.value > 0 ? (currentItemNumber.value / totalItems.value) * 100 : 0
)

const myRank = computed(() => finalResults.value.findIndex(r => r.id === playerId.value) + 1)
const myResult = computed(() => finalResults.value.find(r => r.id === playerId.value))

let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string, type: 'error' | 'success' | 'info' = 'info') {
  toastMsg.value = msg
  toastType.value = type
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 3000)
}

function rankEmoji(rank: number) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
}

function isCorrect(opt: any) {
  return revealData.value && opt.id === currentQuestion.value?.correctAnswerId
}

function isMyWrongAnswer(opt: any) {
  return revealData.value && selectedAnswer.value === opt.id && opt.id !== currentQuestion.value?.correctAnswerId
}
</script>

<template>
  <div class="page" style="max-width:500px;margin:0 auto;">
    <div v-if="toastMsg" class="toast" :class="`toast--${toastType}`">{{ toastMsg }}</div>

    <!-- ── JOIN ─────────────────────────────────────────────────── -->
    <div v-if="screen === 'join'" style="padding-top:3rem;">
      <div class="text-center" style="margin-bottom:2.5rem;">
        <div style="display:flex; justify-content:center; margin-bottom:1.25rem;">
          <OwlMascot size="md" mood="excited" message="Enter your name and hop in!" />
        </div>
        <div class="game-title">Blind Ranking</div>
        <div class="badge badge--cyan mt-md" style="font-size:1.1rem;padding:0.4rem 1.2rem;letter-spacing:0.15em;">
          {{ code }}
        </div>
      </div>
      <div class="card">
        <h2 style="margin-bottom:1.25rem;">Join Game</h2>
        <div class="field">
          <label class="label">Your Name</label>
          <input v-model="playerName" class="input input--lg" placeholder="Enter your name..."
            maxlength="20" autofocus @keydown.enter="joinGame" />
        </div>
        <div v-if="errorMsg" style="color:var(--red);font-size:0.9rem;margin-bottom:0.75rem;">{{ errorMsg }}</div>
        <button class="btn btn--primary btn--lg btn--block" @click="joinGame">Join →</button>
      </div>
      <div class="text-center mt-lg">
        <NuxtLink to="/" class="text-muted" style="font-size:0.85rem;">← Home</NuxtLink>
      </div>
    </div>

    <!-- ── LOBBY ─────────────────────────────────────────────────── -->
    <div v-if="screen === 'lobby'" style="padding-top:2rem;">
      <div class="card text-center" style="margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:center; margin-bottom:0.75rem;">
          <OwlMascot size="sm" mood="thinking" message="Waiting for the host..." />
        </div>
        <h2>Almost time!</h2>
        <div class="waiting-dots mt-md" style="font-size:1.5rem;"><span>●</span><span>●</span><span>●</span></div>
      </div>
      <div class="card">
        <h3 style="margin-bottom:0.75rem;">Players ({{ players.filter(p=>p.connected).length }})</h3>
        <div class="player-grid">
          <div v-for="p in players" :key="p.id" class="player-chip"
            :class="{disconnected:!p.connected}"
            :style="p.id===playerId ? 'border-color:var(--accent);' : ''">
            <div class="player-dot"></div>
            {{ p.name }}
            <span v-if="p.id===playerId" style="color:var(--text-muted);font-size:0.75rem;">(you)</span>
          </div>
        </div>
      </div>
      <p class="text-center text-muted mt-lg" style="font-size:0.85rem;">
        Rank {{ totalItems }} items from your own perspective — no right answers!
      </p>
    </div>

    <!-- ── RANKING ───────────────────────────────────────────────── -->
    <div v-if="screen === 'ranking'">
      <div style="margin-bottom:1rem;">
        <div class="flex-between" style="margin-bottom:0.4rem;">
          <span class="text-muted" style="font-size:0.8rem;">Item {{ currentItemNumber }} of {{ totalItems }}</span>
          <span class="badge badge--cyan" style="font-size:0.75rem;">{{ code }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar__fill" :style="{width: progressPct+'%'}"></div>
        </div>
      </div>

      <!-- Current item -->
      <div v-if="currentItem" style="margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:center; margin-bottom:0.75rem;">
          <OwlMascot
            size="lg"
            :mood="hasPlacedThisRound ? 'celebrate' : 'excited'"
            :message="hasPlacedThisRound ? 'Locked in! ✓' : currentItem.text"
          />
        </div>
        <div class="text-center">
          <span v-if="!hasPlacedThisRound" class="badge badge--yellow">Tap a slot below to rank it</span>
          <span v-else class="badge badge--green">Nice! Pick the next slot while you wait</span>
        </div>
      </div>

      <div v-else style="padding:2rem;text-align:center;color:var(--text-dim);">
        <div style="display:flex; justify-content:center; margin-bottom:0.5rem;">
          <OwlMascot size="sm" mood="thinking" message="Next item incoming..." />
        </div>
      </div>

      <!-- Slots -->
      <div class="slots-list">
        <div
          v-for="slot in totalItems"
          :key="slot"
          class="slot"
          :class="{
            'slot--filled': placements[slot] !== undefined,
            'slot--empty': placements[slot] === undefined,
            'slot--selectable': placements[slot] === undefined && !hasPlacedThisRound && currentItem !== null
          }"
          @click="placeItem(slot)"
        >
          <div class="slot__rank">#{{ slot }}</div>
          <div class="slot__content">
            <template v-if="placements[slot]">
              <img v-if="placements[slot].imageUrl" :src="placements[slot].imageUrl" class="slot__item-img" />
              <span class="slot__item-text">{{ placements[slot].text }}</span>
            </template>
            <span v-else-if="!hasPlacedThisRound && currentItem" class="slot__placeholder">Tap to place here</span>
            <span v-else class="slot__placeholder">Empty</span>
          </div>
        </div>
      </div>

      <p class="text-center text-muted mt-lg" style="font-size:0.8rem;">
        {{ Object.keys(placements).length }} / {{ totalItems }} placed
      </p>
    </div>

    <!-- ── ROUND COMPLETE (last item done, waiting for social) ────── -->
    <div v-if="screen === 'round-complete'" class="text-center" style="padding-top:3rem;">
      <div style="display:flex; justify-content:center; margin-bottom:1rem;">
        <OwlMascot size="md" mood="celebrate" message="Hoot hoot! Rankings locked in!" />
      </div>
      <h2>You ranked everything!</h2>
      <p class="text-muted mt-sm">Waiting for the host to start the social deduction round...</p>
      <div class="waiting-dots mt-lg" style="font-size:1.5rem;"><span>●</span><span>●</span><span>●</span></div>

      <!-- Show your rankings while waiting -->
      <div class="card mt-xl" style="text-align:left;">
        <h3 style="margin-bottom:0.75rem;">Your Rankings</h3>
        <div class="slots-list">
          <div v-for="slot in totalItems" :key="slot" class="slot slot--filled">
            <div class="slot__rank">#{{ slot }}</div>
            <div class="slot__content">
              <template v-if="placements[slot]">
                <img v-if="placements[slot].imageUrl" :src="placements[slot].imageUrl" class="slot__item-img" />
                <span class="slot__item-text">{{ placements[slot].text }}</span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── SOCIAL QUESTION ───────────────────────────────────────── -->
    <div v-if="screen === 'social-question'" style="padding-top:1rem;">
      <div class="flex-between" style="margin-bottom:1rem;">
        <span class="badge badge--yellow">{{ currentQuestion?.category }}</span>
        <span class="text-muted" style="font-size:0.85rem;">{{ questionNumber }} / {{ totalQuestions }}</span>
      </div>

      <div class="progress-bar" style="margin-bottom:1.5rem;">
        <div class="progress-bar__fill" :style="{width: (questionNumber/totalQuestions*100)+'%'}"></div>
      </div>

      <div style="display:flex; justify-content:center; margin-bottom:1.5rem;">
        <OwlMascot
          size="lg"
          mood="thinking"
          :message="currentQuestion?.prompt"
        />
      </div>

      <div style="display:flex;flex-direction:column;gap:0.6rem;">
        <button
          v-for="opt in currentQuestion?.options"
          :key="opt.id"
          class="btn btn--block"
          :class="selectedAnswer === opt.id ? 'btn--primary' : 'btn--ghost'"
          style="justify-content:flex-start;gap:0.75rem;padding:0.85rem 1rem;font-size:1rem;"
          @click="submitSocialAnswer(opt.id)"
        >
          <img v-if="opt.imageUrl" :src="opt.imageUrl"
            style="width:36px;height:36px;object-fit:cover;border-radius:8px;flex-shrink:0;"/>
          {{ opt.label }}
        </button>
      </div>

      <p class="text-center text-muted mt-lg" style="font-size:0.8rem;">
        Running total: <strong style="color:var(--cyan);">{{ totalSocialScore }} pts</strong>
      </p>
    </div>

    <!-- ── SOCIAL WAITING (after submitting answer) ──────────────── -->
    <div v-if="screen === 'social-waiting'" class="text-center" style="padding-top:3rem;">
      <div style="display:flex; justify-content:center; margin-bottom:1rem;">
        <OwlMascot size="md" mood="shush" message="Shhh... waiting for the reveal!" />
      </div>
      <h2>Answer locked in!</h2>
      <p class="text-muted mt-sm">Waiting for the host to reveal...</p>
      <div class="waiting-dots mt-lg" style="font-size:1.5rem;"><span>●</span><span>●</span><span>●</span></div>
      <div class="card mt-xl" style="text-align:left;">
        <p class="text-muted" style="font-size:0.85rem;margin-bottom:0.3rem;">Your answer:</p>
        <strong style="font-size:1.1rem;">
          {{ currentQuestion?.options?.find((o:any)=>o.id===selectedAnswer)?.label ?? selectedAnswer }}
        </strong>
      </div>
    </div>

    <!-- ── SOCIAL RESULT (after answer revealed) ─────────────────── -->
    <div v-if="screen === 'social-result'" style="padding-top:2rem;">
      <div v-if="selectedAnswer === currentQuestion?.correctAnswerId" class="card text-center" style="margin-bottom:1.25rem;border-color:var(--green);background:rgba(16,185,129,0.08);">
        <div style="font-size:3rem;margin-bottom:0.5rem;">🎯</div>
        <h2 style="color:var(--green);">Correct! +{{ pointsEarned }} pts</h2>
      </div>
      <div v-else class="card text-center" style="margin-bottom:1.25rem;border-color:var(--red);background:rgba(239,68,68,0.05);">
        <div style="font-size:3rem;margin-bottom:0.5rem;">❌</div>
        <h2>Not quite!</h2>
      </div>

      <div class="card" style="margin-bottom:1.25rem;">
        <p class="text-muted" style="font-size:0.8rem;margin-bottom:0.5rem;">Answer</p>
        <p style="font-weight:700;">{{ revealData?.explanation }}</p>
      </div>

      <!-- Options colored -->
      <div style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:1.25rem;">
        <div
          v-for="opt in currentQuestion?.options"
          :key="opt.id"
          style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;border-radius:10px;border:1px solid var(--border);"
          :style="isCorrect(opt)
            ? 'border-color:var(--green);background:rgba(16,185,129,0.1)'
            : isMyWrongAnswer(opt)
            ? 'border-color:var(--red);background:rgba(239,68,68,0.08)'
            : 'opacity:0.4'"
        >
          <img v-if="opt.imageUrl" :src="opt.imageUrl"
            style="width:32px;height:32px;object-fit:cover;border-radius:6px;flex-shrink:0;"/>
          <span style="font-weight:600;">{{ opt.label }}</span>
          <span v-if="isCorrect(opt)" style="margin-left:auto;color:var(--green);">✓</span>
          <span v-else-if="isMyWrongAnswer(opt)" style="margin-left:auto;color:var(--red);">✗</span>
        </div>
      </div>

      <div class="card text-center">
        <p class="text-muted" style="font-size:0.85rem;">Total so far</p>
        <div style="font-size:2rem;font-weight:900;color:var(--cyan);">{{ totalSocialScore }} pts</div>
      </div>

      <p class="text-center text-muted mt-lg" style="font-size:0.85rem;">
        Waiting for host to continue...
      </p>
    </div>

    <!-- ── RESULTS ───────────────────────────────────────────────── -->
    <div v-if="screen === 'results'" style="padding-top:1rem;">
      <div style="display:flex; justify-content:center; margin-bottom:1.25rem;">
        <OwlMascot
          size="md"
          mood="celebrate"
          :message="myRank === 1 ? 'Wisest of them all! 🦉' : myRank <= 3 ? 'Solid ranking, wise one!' : 'The owl is proud of you!'"
        />
      </div>
      <div v-if="myResult" class="card card--glow text-center" style="margin-bottom:1.5rem;">
        <div style="font-size:3rem;margin-bottom:0.5rem;">
          {{ myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🎮' }}
        </div>
        <h2>{{ rankEmoji(myRank) }} Place!</h2>
        <div style="font-size:2rem;font-weight:900;color:var(--cyan);margin-top:0.5rem;">
          {{ myResult.socialScore }} pts
        </div>
      </div>

      <div class="card" style="margin-bottom:1.25rem;">
        <h3 style="margin-bottom:1rem;">Final Standings</h3>
        <div class="leaderboard">
          <div v-for="(r,i) in finalResults" :key="r.id" class="leaderboard-row"
            :style="r.id===playerId ? 'border-color:var(--accent);box-shadow:0 0 15px var(--accent-glow)' : ''">
            <div class="lb-rank" style="font-size:1rem;">{{ i+1 }}</div>
            <div class="lb-name">
              {{ r.name }}
              <span v-if="r.id===playerId" style="color:var(--accent);font-size:0.75rem;"> (you)</span>
            </div>
            <div class="lb-score">{{ r.socialScore }}</div>
          </div>
        </div>
      </div>

      <!-- Hot takes + most controversial -->
      <div v-if="socialStats?.mostControversial" class="card" style="margin-bottom:1.25rem; text-align:center;">
        <p class="text-muted" style="font-size:0.8rem; margin-bottom:0.3rem;">Most Controversial</p>
        <strong style="font-size:1.2rem;">🔥 "{{ socialStats.mostControversial.item.text }}"</strong>
      </div>

      <div v-if="socialStats?.players" class="card" style="margin-bottom:1.25rem;">
        <h3 style="margin-bottom:0.75rem;">Your Hot Takes</h3>
        <div v-for="pStat in socialStats.players.filter((p:any)=>p.playerId===playerId)" :key="pStat.playerId">
          <div v-if="pStat.hotTakes?.length" style="display:flex;flex-direction:column;gap:0.5rem;">
            <div v-for="take in pStat.hotTakes" :key="take.item.text"
              style="padding:0.6rem 0.8rem;background:var(--surface);border-radius:10px;font-size:0.9rem;">
              You ranked <strong>"{{ take.item.text }}"</strong> at
              <span style="color:var(--accent);font-weight:700;">#{{ take.playerRank }}</span>
              · group avg: <span style="color:var(--text-muted);">#{{ take.groupAvg }}</span>
            </div>
          </div>
          <p v-else class="text-muted" style="font-size:0.9rem;">You ranked pretty close to the group — no big hot takes!</p>
        </div>
      </div>

      <!-- Your personal rankings recap -->
      <div class="card" style="margin-bottom:1.5rem;">
        <h3 style="margin-bottom:0.75rem;">Your Rankings</h3>
        <div class="slots-list">
          <div v-for="slot in allItems.length" :key="slot" class="slot slot--filled">
            <div class="slot__rank" style="color:var(--cyan);">#{{ slot }}</div>
            <div class="slot__content" v-if="myResult?.placements[slot] !== undefined">
              <img v-if="allItems[myResult.placements[slot]]?.imageUrl"
                :src="allItems[myResult.placements[slot]].imageUrl" class="slot__item-img"/>
              <span class="slot__item-text">{{ allItems[myResult?.placements[slot]]?.text }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex gap-md" style="justify-content:center;">
        <NuxtLink to="/" class="btn btn--primary btn--lg">Play Again</NuxtLink>
      </div>
    </div>
  </div>
</template>
