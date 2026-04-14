<script setup lang="ts">
const { isAdmin } = useAdmin()
const router = useRouter()
const { play } = useSound()

const joinCode = ref('')
const lists = ref<any[]>([])
const selectedListId = ref('')
const loadingGame = ref(false)
const errorMsg = ref('')
const joinShake = ref(false)
const joinPulsing = ref(false)
const cardVisible = ref(false)
const activeTag = ref<string | null>(null)

const allTags = computed(() => {
  const set = new Set<string>()
  for (const list of lists.value) {
    for (const tag of (list.tags || [])) set.add(tag)
  }
  return [...set].sort()
})

const filteredLists = computed(() =>
  activeTag.value
    ? lists.value.filter(l => l.tags?.includes(activeTag.value))
    : lists.value
)

function toggleTag(tag: string) {
  activeTag.value = activeTag.value === tag ? null : tag
  selectedListId.value = ''
  play('click')
}

// Floating orbs parallax
const mouseX = ref(0)
const mouseY = ref(0)

function onMouseMove(e: MouseEvent) {
  mouseX.value = (e.clientX / window.innerWidth - 0.5) * 30
  mouseY.value = (e.clientY / window.innerHeight - 0.5) * 30
}

// Stars
interface Star {
  x: number; y: number; r: number; opacity: number; speed: number; phase: number
}
const stars = ref<Star[]>([])
onMounted(() => {
  for (let i = 0; i < 80; i++) {
    stars.value.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      r: Math.random() * 1.8 + 0.4,
      opacity: Math.random() * 0.6 + 0.2,
      speed: Math.random() * 3 + 2,
      phase: Math.random() * Math.PI * 2,
    })
  }
  setTimeout(() => { cardVisible.value = true }, 100)
  loadLists()
})

async function loadLists() {
  const data = await $fetch<any[]>('/api/lists')
  lists.value = data
}

async function createGame() {
  if (!selectedListId.value) return
  play('whoosh')
  loadingGame.value = true
  errorMsg.value = ''
  try {
    const res = await $fetch<{ code: string }>('/api/games', {
      method: 'POST',
      body: { listId: selectedListId.value }
    })
    play('success')
    router.push(`/host/${res.code}`)
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage || 'Failed to create game'
    play('pop')
  } finally {
    loadingGame.value = false
  }
}

function goPlay() {
  const code = joinCode.value.trim().toUpperCase()
  if (!code) {
    joinShake.value = true
    play('pop')
    setTimeout(() => { joinShake.value = false }, 500)
    return
  }
  play('join')
  joinPulsing.value = true
  setTimeout(() => {
    router.push(`/play/${code}`)
  }, 300)
}

function onJoinInput() {
  joinCode.value = joinCode.value.toUpperCase()
}

function onBtnHover() {
  play('click')
}
</script>

<template>
  <div class="page index-page" @mousemove="onMouseMove">

    <!-- Starfield -->
    <svg class="starfield" aria-hidden="true">
      <circle
        v-for="(star, i) in stars"
        :key="i"
        :cx="`${star.x}%`"
        :cy="`${star.y}%`"
        :r="star.r"
        :fill="`rgba(200,180,255,${star.opacity})`"
        :style="`animation: starTwinkle ${star.speed}s ease-in-out ${star.phase}s infinite alternate`"
      />
    </svg>

    <!-- Floating background orbs -->
    <div class="orb orb--1" :style="`transform: translate(${mouseX * 0.4}px, ${mouseY * 0.4}px)`" />
    <div class="orb orb--2" :style="`transform: translate(${-mouseX * 0.25}px, ${-mouseY * 0.25}px)`" />
    <div class="orb orb--3" :style="`transform: translate(${mouseX * 0.15}px, ${mouseY * 0.6}px)`" />

    <div class="container" style="max-width:680px; padding-top: 3rem; position:relative;">

      <!-- Hero -->
      <div class="text-center hero-block" :class="{ 'hero-block--visible': cardVisible }">
        <div class="owl-hero-wrap">
          <OwlMascot
            size="xl"
            mood="excited"
            message="Hoo's ready to rank? Let's go!"
          />
        </div>

        <h1 class="game-title game-title--animated">Blind Ranking</h1>

        <p class="hero-sub mt-sm">
          Rank items without knowing what's coming next.<br>
          <span class="hero-sub--highlight">The ultimate party challenge.</span>
        </p>

        <!-- Feature pills -->
        <div class="feature-pills">
          <span class="feature-pill">🎮 Multiplayer</span>
          <span class="feature-pill">🎲 Blind draws</span>
          <span class="feature-pill">🏆 Leaderboard</span>
          <span class="feature-pill">🦉 Owl-powered</span>
        </div>
      </div>

      <!-- Join a game -->
      <div
        class="card card--animated"
        :class="{ 'card--visible': cardVisible, 'join-shake': joinShake, 'join-pulse': joinPulsing }"
        style="margin-bottom:1.25rem; animation-delay: 0.1s;"
      >
        <div class="card-header-row">
          <span class="card-icon">🎮</span>
          <h2>Join a Game</h2>
        </div>
        <p class="text-muted" style="margin-bottom:1.25rem; font-size:0.9rem;">
          Enter the 4-letter code shown on the host screen.
        </p>
        <div class="flex gap-md">
          <div class="code-input-wrap">
            <input
              v-model="joinCode"
              class="input input--lg input--code"
              placeholder="ABCD"
              maxlength="4"
              @input="onJoinInput"
              @keydown.enter="goPlay"
            />
            <div class="code-input-chars">
              <span
                v-for="i in 4"
                :key="i"
                class="code-char-indicator"
                :class="{ active: joinCode.length >= i }"
              />
            </div>
          </div>
          <button
            class="btn btn--cyan btn--lg btn--join"
            style="flex-shrink:0;"
            @mouseenter="onBtnHover"
            @click="goPlay"
          >
            <span class="btn-text">Join</span>
            <span class="btn-arrow">→</span>
          </button>
        </div>
      </div>

      <!-- Host a game -->
      <div
        class="card card--animated"
        :class="{ 'card--visible': cardVisible }"
        style="margin-bottom:1.25rem; animation-delay: 0.2s;"
      >
        <div class="card-header-row">
          <span class="card-icon">📡</span>
          <h2>Host a Game</h2>
        </div>
        <p class="text-muted" style="margin-bottom:1.25rem; font-size:0.9rem;">
          Select a list and get a lobby code to share with players.
        </p>

        <div v-if="lists.length === 0" class="empty-lists">
          <span class="empty-lists__icon">📋</span>
          <span class="text-muted" style="font-size:0.9rem;">No lists available yet.</span>
          <NuxtLink v-if="isAdmin" to="/lists/create" class="btn btn--ghost btn--sm">
            Create one →
          </NuxtLink>
        </div>

        <div v-else>
          <!-- Tag filter -->
          <div v-if="allTags.length" class="host-tag-row">
            <button
              v-for="tag in allTags"
              :key="tag"
              class="tag-filter-btn"
              :class="{ active: activeTag === tag }"
              @click="toggleTag(tag)"
            >{{ tag }}</button>
            <button v-if="activeTag" class="tag-filter-btn tag-filter-btn--clear" @click="toggleTag(activeTag)">
              ✕ Clear
            </button>
          </div>

          <div class="field">
            <label class="label">
              Choose a List
              <span v-if="activeTag" class="tag-filter-label">— {{ filteredLists.length }} matching</span>
            </label>
            <div class="select-wrap">
              <select
                v-model="selectedListId"
                class="input"
                @change="play('click')"
              >
                <option value="">— Select a list —</option>
                <option v-for="list in filteredLists" :key="list._id" :value="list._id">
                  {{ list.name }} ({{ list.items?.length || 0 }} items)
                </option>
              </select>
              <span class="select-arrow">▾</span>
            </div>
            <p v-if="activeTag && filteredLists.length === 0" style="color:var(--text-dim); font-size:0.85rem; margin-top:0.4rem;">
              No lists tagged "{{ activeTag }}"
            </p>
          </div>

          <div v-if="errorMsg" class="error-msg">
            ⚠ {{ errorMsg }}
          </div>

          <button
            class="btn btn--primary btn--lg btn--block btn--host"
            :class="{ 'btn--loading': loadingGame }"
            :disabled="!selectedListId || loadingGame"
            @mouseenter="onBtnHover"
            @click="createGame"
          >
            <span v-if="loadingGame" class="btn-spinner" />
            <span v-else class="btn-icon">🚀</span>
            {{ loadingGame ? 'Creating lobby…' : 'Create Lobby' }}
          </button>
        </div>
      </div>

      <!-- Admin link -->
      <div
        v-if="isAdmin"
        class="admin-row card--animated"
        :class="{ 'card--visible': cardVisible }"
        style="animation-delay: 0.3s;"
      >
        <span class="text-muted" style="font-size:0.9rem;">🔐 Manage content</span>
        <NuxtLink to="/lists" class="btn btn--ghost btn--sm" @mouseenter="onBtnHover">
          Manage Lists →
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Page base ───────────────────────────────────── */
.index-page {
  position: relative;
  overflow: hidden;
  background: radial-gradient(ellipse at 20% 10%, rgba(124,58,237,0.18) 0%, transparent 55%),
              radial-gradient(ellipse at 80% 80%, rgba(6,182,212,0.12) 0%, transparent 50%),
              var(--bg);
}

/* ── Starfield ───────────────────────────────────── */
.starfield {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

@keyframes starTwinkle {
  from { opacity: 0.15; transform: scale(0.8); }
  to   { opacity: 0.9;  transform: scale(1.2); }
}

/* ── Floating orbs ───────────────────────────────── */
.orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
  transition: transform 0.1s linear;
}
.orb--1 {
  width: 420px; height: 420px;
  background: radial-gradient(circle, rgba(124,58,237,0.25), transparent 70%);
  top: -100px; left: -100px;
  animation: orbDrift 18s ease-in-out infinite alternate;
}
.orb--2 {
  width: 340px; height: 340px;
  background: radial-gradient(circle, rgba(6,182,212,0.18), transparent 70%);
  bottom: -80px; right: -80px;
  animation: orbDrift 14s ease-in-out infinite alternate-reverse;
}
.orb--3 {
  width: 220px; height: 220px;
  background: radial-gradient(circle, rgba(168,85,247,0.15), transparent 70%);
  top: 50%; left: 60%;
  animation: orbDrift 22s ease-in-out infinite alternate;
}

@keyframes orbDrift {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(40px, 30px) scale(1.08); }
}

/* ── Hero block ──────────────────────────────────── */
.hero-block {
  margin-bottom: 2.5rem;
  position: relative;
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.hero-block--visible {
  opacity: 1;
  transform: translateY(0);
}

.owl-hero-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
  filter: drop-shadow(0 0 32px rgba(124,58,237,0.5));
}

.game-title--animated {
  animation: titleShimmer 4s ease-in-out infinite;
  background-size: 200% 100%;
}

@keyframes titleShimmer {
  0%, 100% { background-position: 0% 50%; }
  50%       { background-position: 100% 50%; }
}

.hero-sub {
  color: var(--text-muted);
  font-size: 1.05rem;
  line-height: 1.7;
}
.hero-sub--highlight {
  color: var(--cyan);
  font-weight: 600;
}

/* ── Feature pills ───────────────────────────────── */
.feature-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
  margin-top: 1.25rem;
}

.feature-pill {
  padding: 0.35rem 0.9rem;
  background: rgba(124,58,237,0.12);
  border: 1px solid rgba(124,58,237,0.3);
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-muted);
  animation: pillFloat 3s ease-in-out infinite;
}
.feature-pill:nth-child(2) { animation-delay: 0.4s; }
.feature-pill:nth-child(3) { animation-delay: 0.8s; }
.feature-pill:nth-child(4) { animation-delay: 1.2s; }

@keyframes pillFloat {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-3px); }
}

/* ── Card entrance ───────────────────────────────── */
.card--animated {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.55s ease, transform 0.55s ease, box-shadow 0.25s ease, border-color 0.25s ease;
  position: relative;
  z-index: 1;
}
.card--animated.card--visible {
  opacity: 1;
  transform: translateY(0);
}

.card:hover {
  border-color: rgba(124,58,237,0.5);
  box-shadow: 0 0 32px rgba(124,58,237,0.12);
}

/* ── Card header row ─────────────────────────────── */
.card-header-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 1rem;
}
.card-header-row h2 { margin: 0; }
.card-icon {
  font-size: 1.4rem;
  line-height: 1;
}

/* ── Code input ──────────────────────────────────── */
.code-input-wrap {
  flex: 1;
  position: relative;
}

.input--code {
  text-transform: uppercase;
  letter-spacing: 0.35em;
  font-weight: 900;
  font-size: 1.6rem;
  text-align: center;
  font-family: 'Courier New', monospace;
  border-color: rgba(6,182,212,0.35);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input--code:focus {
  border-color: var(--cyan);
  box-shadow: 0 0 20px rgba(6,182,212,0.25);
}

.code-input-chars {
  display: flex;
  justify-content: center;
  gap: 0.35rem;
  margin-top: 0.4rem;
}
.code-char-indicator {
  width: 10px; height: 4px;
  border-radius: 2px;
  background: var(--border);
  transition: background 0.2s, transform 0.2s;
}
.code-char-indicator.active {
  background: var(--cyan);
  transform: scaleX(1.3);
}

/* ── Join button ─────────────────────────────────── */
.btn--join {
  position: relative;
  overflow: hidden;
  min-width: 100px;
}
.btn--join::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.15);
  transform: translateX(-100%);
  transition: transform 0.3s ease;
}
.btn--join:hover::before { transform: translateX(0); }
.btn-arrow {
  display: inline-block;
  transition: transform 0.2s ease;
}
.btn--join:hover .btn-arrow { transform: translateX(4px); }

/* ── Join shake animation ────────────────────────── */
.join-shake {
  animation: shake 0.4s ease !important;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-8px); }
  40%       { transform: translateX(8px); }
  60%       { transform: translateX(-6px); }
  80%       { transform: translateX(4px); }
}

.join-pulse { animation: cardPulse 0.3s ease; }
@keyframes cardPulse {
  0%   { box-shadow: 0 0 0 rgba(6,182,212,0); }
  50%  { box-shadow: 0 0 40px rgba(6,182,212,0.5); }
  100% { box-shadow: 0 0 0 rgba(6,182,212,0); }
}

/* ── Select wrapper ──────────────────────────────── */
.select-wrap {
  position: relative;
}
.select-wrap .input {
  appearance: none;
  padding-right: 2.5rem;
  cursor: pointer;
}
.select-arrow {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
  font-size: 1rem;
}

/* ── Host button ─────────────────────────────────── */
.btn--host {
  margin-top: 0.25rem;
  position: relative;
  overflow: hidden;
}
.btn--host::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
  transform: translateX(-100%);
}
.btn--host:not(:disabled):hover::after {
  animation: shimmerSweep 0.6s ease forwards;
}
@keyframes shimmerSweep {
  to { transform: translateX(100%); }
}
.btn-icon { font-size: 1.1rem; }
.btn-spinner {
  display: inline-block;
  width: 18px; height: 18px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* ── Empty lists state ───────────────────────────── */
.empty-lists {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 0.5rem 0;
}
.empty-lists__icon { font-size: 1.4rem; }

/* ── Error ───────────────────────────────────────── */
.error-msg {
  color: var(--red);
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 8px;
}

/* ── Admin row ───────────────────────────────────── */
.admin-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
}

/* ── Host tag filter row ─────────────────────────── */
.host-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.tag-filter-label {
  font-weight: 400;
  color: var(--text-dim);
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.8rem;
  margin-left: 0.4rem;
}

/* ── Responsive ──────────────────────────────────── */
@media (max-width: 500px) {
  .feature-pills { gap: 0.4rem; }
  .feature-pill  { font-size: 0.75rem; }
  .input--code   { font-size: 1.3rem; letter-spacing: 0.25em; }
}
</style>
