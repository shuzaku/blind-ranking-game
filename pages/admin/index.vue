<script setup lang="ts">
const { isAdmin, setAdmin } = useAdmin()
const router = useRouter()
const route = useRoute()

const pin = ref('')
const error = ref('')
const loading = ref(false)

// Already admin — go straight to destination
onMounted(() => {
  if (isAdmin.value) {
    router.replace((route.query.redirect as string) || '/lists')
  }
})

async function submit() {
  if (!pin.value.trim()) { error.value = 'Enter your PIN'; return }
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/verify', { method: 'POST', body: { pin: pin.value } })
    sessionStorage.setItem('adminPin', pin.value)
    setAdmin(true)
    router.replace((route.query.redirect as string) || '/lists')
  } catch {
    error.value = 'Wrong PIN. Try again.'
    pin.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="container" style="max-width:400px; padding-top:4rem;">
      <div class="text-center" style="margin-bottom:2rem;">
        <OwlMascot size="md" mood="shush" message="Admins only beyond here." />
      </div>

      <div class="card">
        <h2 style="margin-bottom:1.5rem;">Admin Login</h2>

        <div class="field">
          <label class="label">PIN</label>
          <input
            v-model="pin"
            class="input input--lg"
            type="password"
            placeholder="Enter admin PIN..."
            autofocus
            @keydown.enter="submit"
          />
        </div>

        <div v-if="error" style="color:var(--red); font-size:0.9rem; margin-bottom:0.75rem;">
          {{ error }}
        </div>

        <button class="btn btn--primary btn--lg btn--block" :disabled="loading" @click="submit">
          {{ loading ? 'Checking...' : 'Enter →' }}
        </button>
      </div>

      <div class="text-center mt-lg">
        <NuxtLink to="/" class="text-muted" style="font-size:0.85rem;">← Home</NuxtLink>
      </div>
    </div>
  </div>
</template>
