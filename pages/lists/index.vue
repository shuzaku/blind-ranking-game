<script setup lang="ts">
const lists = ref<any[]>([])
const loading = ref(true)

async function load() {
  lists.value = await $fetch<any[]>('/api/lists')
  loading.value = false
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="container">
      <div class="flex-between" style="margin-bottom:2rem;">
        <div>
          <h1>My Lists</h1>
          <p class="text-muted mt-sm">Manage your ranking lists.</p>
        </div>
        <div class="flex gap-md">
          <NuxtLink to="/" class="btn btn--ghost">← Home</NuxtLink>
          <NuxtLink to="/lists/create" class="btn btn--primary">+ New List</NuxtLink>
        </div>
      </div>

      <div v-if="loading" class="flex-center" style="padding:3rem;">
        <div class="spinner"></div>
      </div>

      <div v-else-if="lists.length === 0" class="card text-center" style="padding:3rem;">
        <div style="font-size:3rem; margin-bottom:1rem;">📋</div>
        <h2>No lists yet</h2>
        <p class="text-muted mt-sm">Create your first ranking list to start playing.</p>
        <NuxtLink to="/lists/create" class="btn btn--primary mt-lg">Create a List</NuxtLink>
      </div>

      <div v-else style="display:flex; flex-direction:column; gap:0.75rem;">
        <div v-for="list in lists" :key="list._id" class="card">
          <div class="flex-between">
            <div>
              <h3>{{ list.name }}</h3>
              <div class="flex gap-sm mt-sm">
                <span class="badge badge--cyan">{{ list.items?.length || 0 }} items</span>
                <span v-if="list.description" class="text-muted" style="font-size:0.85rem;">
                  {{ list.description }}
                </span>
              </div>
            </div>
            <div class="flex gap-sm">
              <NuxtLink :to="`/lists/${list._id}`" class="btn btn--ghost btn--sm">Edit</NuxtLink>
            </div>
          </div>

          <!-- Item preview -->
          <div v-if="list.items?.length" class="correct-ranking" style="margin-top:0.75rem;">
            <div
              v-for="(item, i) in list.items.slice(0,5)"
              :key="i"
              class="correct-item"
            >
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
    </div>
  </div>
</template>
