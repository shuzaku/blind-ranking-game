<script setup lang="ts">
const { isAdmin, adminHeaders } = useAdmin()
const router = useRouter()

onMounted(() => {
  if (!isAdmin.value) router.replace('/admin?redirect=/lists/create')
})

const form = ref({
  name: '',
  description: '',
  items: [] as Array<{ text: string; imageUrl: string }>
})

const saving = ref(false)
const errorMsg = ref('')

async function save() {
  if (!form.value.name.trim()) { errorMsg.value = 'List name is required'; return }
  const validItems = form.value.items.filter(i => i.text.trim())
  if (validItems.length < 2) { errorMsg.value = 'Add at least 2 items'; return }

  saving.value = true
  errorMsg.value = ''
  try {
    await $fetch('/api/lists', {
      method: 'POST',
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
        <h1>Create List</h1>
        <NuxtLink to="/lists" class="btn btn--ghost">← Back</NuxtLink>
      </div>

      <div class="card">
        <div class="field">
          <label class="label">List Name *</label>
          <input v-model="form.name" class="input input--lg" placeholder="e.g. Best Fast Foods" />
        </div>

        <div class="field">
          <label class="label">Description</label>
          <input v-model="form.description" class="input" placeholder="Optional description..." />
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
            {{ saving ? 'Saving...' : 'Save List' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
