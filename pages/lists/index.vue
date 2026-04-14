<script setup lang="ts">
const { isAdmin, adminHeaders } = useAdmin()
const lists = ref<any[]>([])
const loading = ref(true)
const deletingId = ref<string | null>(null)
const confirmId = ref<string | null>(null)
const activeTag = ref<string | null>(null)

async function load() {
  lists.value = await $fetch<any[]>('/api/lists')
  loading.value = false
}

async function deleteList(id: string) {
  deletingId.value = id
  try {
    await $fetch(`/api/lists/${id}`, { method: 'DELETE', headers: adminHeaders() })
    lists.value = lists.value.filter(l => l._id !== id)
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to delete')
  } finally {
    deletingId.value = null
    confirmId.value = null
  }
}

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
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="container">
      <div class="flex-between" style="margin-bottom:2rem;">
        <div>
          <h1>Lists</h1>
          <p class="text-muted mt-sm">Ranking lists available to play.</p>
        </div>
        <div class="flex gap-md">
          <NuxtLink to="/" class="btn btn--ghost">← Home</NuxtLink>
          <NuxtLink v-if="isAdmin" to="/lists/create" class="btn btn--primary">+ New List</NuxtLink>
        </div>
      </div>

      <div v-if="loading" class="flex-center" style="padding:3rem;">
        <div class="spinner"></div>
      </div>

      <template v-else>
        <!-- Tag filter bar -->
        <div v-if="allTags.length" style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:1.25rem; align-items:center;">
          <span class="text-muted" style="font-size:0.82rem; font-weight:600; text-transform:uppercase; letter-spacing:0.06em;">Filter:</span>
          <button
            v-for="tag in allTags"
            :key="tag"
            class="tag-filter-btn"
            :class="{ active: activeTag === tag }"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </button>
          <button v-if="activeTag" class="tag-filter-btn tag-filter-btn--clear" @click="activeTag = null">
            ✕ Clear
          </button>
        </div>

        <div v-if="filteredLists.length === 0" class="card text-center" style="padding:3rem;">
          <div style="font-size:3rem; margin-bottom:1rem;">📋</div>
          <h2>{{ activeTag ? `No lists tagged "${activeTag}"` : 'No lists yet' }}</h2>
          <p v-if="isAdmin && !activeTag" class="text-muted mt-sm">Create your first ranking list to start playing.</p>
          <p v-else class="text-muted mt-sm">Try a different tag or clear the filter.</p>
          <NuxtLink v-if="isAdmin && !activeTag" to="/lists/create" class="btn btn--primary mt-lg">Create a List</NuxtLink>
        </div>

        <div v-else style="display:flex; flex-direction:column; gap:0.75rem;">
          <div v-for="list in filteredLists" :key="list._id" class="card">
            <div class="flex-between">
              <div style="flex:1; min-width:0;">
                <h3>{{ list.name }}</h3>
                <div class="flex gap-sm mt-sm" style="flex-wrap:wrap; align-items:center;">
                  <span class="badge badge--cyan">{{ list.items?.length || 0 }} items</span>
                  <span v-if="list.description" class="text-muted" style="font-size:0.85rem;">
                    {{ list.description }}
                  </span>
                </div>
                <!-- Tags -->
                <div v-if="list.tags?.length" style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.5rem;">
                  <button
                    v-for="tag in list.tags"
                    :key="tag"
                    class="tag-filter-btn"
                    :class="{ active: activeTag === tag }"
                    style="font-size:0.75rem;"
                    @click="toggleTag(tag)"
                  >
                    {{ tag }}
                  </button>
                </div>
              </div>
              <div class="flex gap-sm" style="flex-shrink:0; margin-left:1rem;">
                <NuxtLink v-if="isAdmin" :to="`/lists/${list._id}`" class="btn btn--ghost btn--sm">Edit</NuxtLink>
                <template v-if="isAdmin">
                  <button
                    v-if="confirmId !== list._id"
                    class="btn btn--danger btn--sm"
                    @click="confirmId = list._id"
                  >Delete</button>
                  <template v-else>
                    <button
                      class="btn btn--danger btn--sm"
                      :disabled="deletingId === list._id"
                      @click="deleteList(list._id)"
                    >{{ deletingId === list._id ? '…' : 'Confirm' }}</button>
                    <button class="btn btn--ghost btn--sm" @click="confirmId = null">Cancel</button>
                  </template>
                </template>
              </div>
            </div>

            <!-- Item preview -->
            <div v-if="list.items?.length" class="correct-ranking" style="margin-top:0.75rem;">
              <div v-for="(item, i) in list.items.slice(0,5)" :key="i" class="correct-item">
                <span class="correct-item__rank">#{{ i + 1 }}</span>
                <img v-if="item.imageUrl" :src="item.imageUrl" class="correct-item__img" />
                <span>{{ item.text }}</span>
              </div>
              <div v-if="list.items.length > 5" class="correct-item text-muted">
                +{{ list.items.length - 5 }} more
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
