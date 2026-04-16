<script setup lang="ts">
const { isAdmin, adminHeaders } = useAdmin()
const route = useRoute()
const router = useRouter()
const id = route.params.id as string

onMounted(() => {
  if (!isAdmin.value) router.replace(`/admin?redirect=/lists/${id}`)
})

const form = ref({
  name: '',
  description: '',
  tags: [] as string[],
  items: [] as Array<{ text: string; imageUrl: string }>
})

const loading = ref(true)
const saving = ref(false)
const errorMsg = ref('')

onMounted(async () => {
  const data = await $fetch<any>(`/api/lists/${id}`)
  form.value = {
    name: data.name,
    description: data.description || '',
    tags: data.tags || [],
    items: (data.items || []).map((i: any) => ({ text: i.text, imageUrl: i.imageUrl || '', youtubeUrl: i.youtubeUrl || '' }))
  }
  loading.value = false
})

async function save() {
  if (!form.value.name.trim()) { errorMsg.value = 'List name is required'; return }
  const validItems = form.value.items.filter(i => i.text.trim())
  if (validItems.length < 2) { errorMsg.value = 'Add at least 2 items'; return }

  saving.value = true
  errorMsg.value = ''
  try {
    await $fetch(`/api/lists/${id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: { ...form.value, items: validItems }
    })
    router.push('/lists')
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage || 'Failed to save'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="container" style="max-width:720px;">
      <div class="flex-between" style="margin-bottom:2rem;">
        <h1>Edit List</h1>
        <NuxtLink to="/lists" class="btn btn--ghost">← Back</NuxtLink>
      </div>

      <div v-if="loading" class="flex-center" style="padding:3rem;">
        <div class="spinner"></div>
      </div>

      <div v-else class="card">
        <div class="field">
          <label class="label">List Name *</label>
          <input v-model="form.name" class="input input--lg" placeholder="e.g. Best Fast Foods" />
        </div>

        <div class="field">
          <label class="label">Description</label>
          <input v-model="form.description" class="input" placeholder="Optional description..." />
        </div>

        <div class="field">
          <label class="label">Tags</label>
          <TagInput v-model="form.tags" />
        </div>

        <div class="divider"></div>

        <ListEditor v-model="form.items" />

        <div class="divider"></div>

        <div v-if="errorMsg" style="color:var(--red); font-size:0.9rem; margin-bottom:0.75rem;">
          {{ errorMsg }}
        </div>

        <div class="flex gap-md" style="justify-content:flex-end;">
          <NuxtLink to="/lists" class="btn btn--ghost">Cancel</NuxtLink>
          <button class="btn btn--primary btn--lg" :disabled="saving" @click="save">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
