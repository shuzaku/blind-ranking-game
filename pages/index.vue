<script setup lang="ts">
const router = useRouter()

const joinCode = ref('')
const showCreateModal = ref(false)
const lists = ref<any[]>([])
const selectedListId = ref('')
const loadingGame = ref(false)
const errorMsg = ref('')

async function loadLists() {
  const data = await $fetch<any[]>('/api/lists')
  lists.value = data
}

async function createGame() {
  if (!selectedListId.value) return
  loadingGame.value = true
  errorMsg.value = ''
  try {
    const res = await $fetch<{ code: string }>('/api/games', {
      method: 'POST',
      body: { listId: selectedListId.value }
    })
    router.push(`/host/${res.code}`)
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage || 'Failed to create game'
  } finally {
    loadingGame.value = false
  }
}

function goPlay() {
  const code = joinCode.value.trim().toUpperCase()
  if (!code) return
  router.push(`/play/${code}`)
}

onMounted(loadLists)
</script>

<template>
  <div class="page">
    <div class="container" style="max-width:680px; padding-top: 3rem;">
      <!-- Title -->
      <div class="text-center" style="margin-bottom: 3rem;">
        <div style="display:flex; justify-content:center; margin-bottom:1.25rem;">
          <OwlMascot
            size="lg"
            mood="excited"
            message="Hoo's ready to rank? Let's go!"
          />
        </div>
        <div class="game-title">Blind Ranking</div>
        <p class="text-muted mt-sm" style="font-size:1.05rem;">
          Rank items without knowing what's coming next. The ultimate party challenge.
        </p>
      </div>

      <!-- Join a game -->
      <div class="card" style="margin-bottom:1.25rem;">
        <h2 style="margin-bottom:1rem;">Join a Game</h2>
        <p class="text-muted" style="margin-bottom:1.25rem; font-size:0.9rem;">
          Enter the 4-letter code shown on the host screen.
        </p>
        <div class="flex gap-md">
          <input
            v-model="joinCode"
            class="input input--lg"
            placeholder="Enter code (e.g. ABCD)"
            maxlength="4"
            style="text-transform:uppercase; letter-spacing:0.2em; font-weight:800;"
            @keydown.enter="goPlay"
          />
          <button class="btn btn--cyan btn--lg" style="flex-shrink:0;" @click="goPlay">
            Join →
          </button>
        </div>
      </div>

      <!-- Host a game -->
      <div class="card" style="margin-bottom:1.25rem;">
        <h2 style="margin-bottom:1rem;">Host a Game</h2>
        <p class="text-muted" style="margin-bottom:1.25rem; font-size:0.9rem;">
          Select a list and get a lobby code to share with players.
        </p>

        <div v-if="lists.length === 0" class="text-muted" style="font-size:0.9rem;">
          No lists yet.
          <NuxtLink to="/lists/create" style="color:var(--accent);">Create one first →</NuxtLink>
        </div>

        <div v-else>
          <div class="field">
            <label class="label">Choose a List</label>
            <select v-model="selectedListId" class="input">
              <option value="">— Select a list —</option>
              <option v-for="list in lists" :key="list._id" :value="list._id">
                {{ list.name }} ({{ list.items?.length || 0 }} items)
              </option>
            </select>
          </div>

          <div v-if="errorMsg" style="color:var(--red); font-size:0.9rem; margin-bottom:0.75rem;">
            {{ errorMsg }}
          </div>

          <button
            class="btn btn--primary btn--lg btn--block"
            :disabled="!selectedListId || loadingGame"
            @click="createGame"
          >
            {{ loadingGame ? 'Creating...' : 'Create Lobby' }}
          </button>
        </div>
      </div>

      <!-- Manage Lists -->
      <div class="flex-between">
        <span class="text-muted" style="font-size:0.9rem;">Need a list?</span>
        <NuxtLink to="/lists" class="btn btn--ghost btn--sm">Manage Lists →</NuxtLink>
      </div>
    </div>
  </div>
</template>
