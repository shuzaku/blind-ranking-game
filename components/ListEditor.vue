<script setup lang="ts">
interface Item {
  text: string
  imageUrl: string
  youtubeUrl: string
  _uploading?: boolean
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function youtubeThumbnail(url: string): string | null {
  const id = extractYouTubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

const props = defineProps<{
  modelValue: Item[]
}>()

const emit = defineEmits<{
  'update:modelValue': [Item[]]
}>()

const items = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

// ── Bulk import ───────────────────────────────────────────────────────────────
const showBulk = ref(false)
const bulkText = ref('')
const bulkError = ref('')

function applyBulk() {
  bulkError.value = ''
  const lines = bulkText.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  if (lines.length === 0) {
    bulkError.value = 'Paste at least one item.'
    return
  }

  const newItems: Item[] = lines.map(line => ({ text: line, imageUrl: '', youtubeUrl: '' }))
  // Merge: keep existing items, append new ones (dedup by text)
  const existingTexts = new Set(items.value.map(i => i.text.toLowerCase()))
  const toAdd = newItems.filter(i => !existingTexts.has(i.text.toLowerCase()))
  // Strip any blank placeholder rows before merging
  const cleaned = items.value.filter(i => i.text.trim() !== '')
  items.value = [...cleaned, ...toAdd]

  bulkText.value = ''
  showBulk.value = false
}

function addItem() {
  items.value = [...items.value, { text: '', imageUrl: '', youtubeUrl: '' }]
  nextTick(() => {
    const input = document.getElementById(`item-input-${items.value.length - 1}`) as HTMLInputElement
    input?.focus()
  })
}

function removeItem(index: number) {
  items.value = items.value.filter((_, i) => i !== index)
}

function moveUp(index: number) {
  if (index === 0) return
  const arr = [...items.value]
  ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
  items.value = arr
}

function moveDown(index: number) {
  if (index === items.value.length - 1) return
  const arr = [...items.value]
  ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
  items.value = arr
}

function updateItem(index: number, field: keyof Item, value: string) {
  const arr = [...items.value]
  arr[index] = { ...arr[index], [field]: value }
  items.value = arr
}

function addItemAt(index: number) {
  const arr = [...items.value]
  arr.splice(index + 1, 0, { text: '', imageUrl: '', youtubeUrl: '' })
  items.value = arr
  nextTick(() => {
    const input = document.getElementById(`item-input-${index + 1}`) as HTMLInputElement
    input?.focus()
  })
}

function handleItemKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    addItemAt(index)
  } else if (event.key === 'Backspace') {
    const input = event.target as HTMLInputElement
    if (input.value === '' && items.value.length > 1) {
      event.preventDefault()
      removeItem(index)
      nextTick(() => {
        const prev = document.getElementById(`item-input-${Math.max(0, index - 1)}`) as HTMLInputElement
        prev?.focus()
      })
    }
  }
}

function triggerUpload(index: number) {
  const input = document.getElementById(`file-input-${index}`) as HTMLInputElement
  input?.click()
}

async function handleFileUpload(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const arr = [...items.value]
  arr[index] = { ...arr[index], _uploading: true }
  items.value = arr

  try {
    const formData = new FormData()
    formData.append('image', file)
    const res = await $fetch<{ url: string }>('/api/upload', {
      method: 'POST',
      body: formData
    })
    const updated = [...items.value]
    updated[index] = { ...updated[index], imageUrl: res.url, _uploading: false }
    items.value = updated
  } catch {
    const updated = [...items.value]
    updated[index] = { ...updated[index], _uploading: false }
    items.value = updated
    alert('Failed to upload image')
  }
  input.value = ''
}

function removeImage(index: number) {
  updateItem(index, 'imageUrl', '')
}
</script>

<template>
  <div>
    <div class="flex-between" style="margin-bottom:0.75rem;">
      <div>
        <label class="label">Items</label>
        <p class="text-muted" style="font-size:0.8rem; margin-top:0.2rem;">
          Add as many items as you like. Each game randomly picks 10 to rank.
        </p>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button type="button" class="btn btn--ghost btn--sm" @click="showBulk = !showBulk">
          {{ showBulk ? '✕ Cancel' : '⚡ Bulk Add' }}
        </button>
        <button type="button" class="btn btn--ghost btn--sm" @click="addItem">+ Add Item</button>
      </div>
    </div>

    <!-- Bulk import panel -->
    <div v-if="showBulk" style="margin-bottom:1rem; padding:1rem; background:var(--surface); border:1px solid var(--border); border-radius:12px;">
      <label class="label" style="margin-bottom:0.4rem;">Paste items — one per line</label>
      <textarea
        v-model="bulkText"
        class="input"
        rows="8"
        placeholder="McDonald's&#10;Burger King&#10;Wendy's&#10;Five Guys&#10;..."
        style="font-family: monospace; font-size: 0.9rem; resize: vertical;"
        autofocus
      />
      <div v-if="bulkError" style="color:var(--red); font-size:0.85rem; margin-top:0.4rem;">{{ bulkError }}</div>
      <div style="display:flex; gap:0.5rem; margin-top:0.75rem; justify-content:flex-end;">
        <button type="button" class="btn btn--ghost btn--sm" @click="showBulk = false; bulkText = ''; bulkError = ''">Cancel</button>
        <button type="button" class="btn btn--primary btn--sm" @click="applyBulk">
          Add {{ bulkText.split('\n').filter(l => l.trim()).length || 0 }} items
        </button>
      </div>
    </div>

    <div
      v-if="items.length === 0"
      style="padding:1.5rem; text-align:center; color:var(--text-dim); border:1px dashed var(--border); border-radius:12px; cursor:pointer;"
      @click="addItem"
    >
      Click to add your first item
    </div>

    <div v-for="(item, index) in items" :key="index" class="list-item-row">
      <!-- Rank badge -->
      <span class="list-item-row__rank">#{{ index + 1 }}</span>

      <!-- Media: image or YouTube thumbnail -->
      <div style="position:relative; flex-shrink:0;">
        <!-- YouTube thumbnail takes priority if set -->
        <template v-if="item.youtubeUrl && extractYouTubeId(item.youtubeUrl)">
          <div style="position:relative; width:48px; height:48px;">
            <img
              :src="youtubeThumbnail(item.youtubeUrl)!"
              class="list-item-row__img-thumb"
              style="cursor:default;"
              title="YouTube video"
            />
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);border-radius:8px;">
              <span style="font-size:1rem;">▶</span>
            </div>
          </div>
        </template>
        <template v-else>
          <img
            v-if="item.imageUrl"
            :src="item.imageUrl"
            class="list-item-row__img-thumb"
            @click="triggerUpload(index)"
            style="cursor:pointer;"
            title="Click to change image"
          />
          <div
            v-else-if="item._uploading"
            class="list-item-row__img-placeholder"
            style="cursor:default;"
          >
            <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
          </div>
          <div
            v-else
            class="list-item-row__img-placeholder"
            @click="triggerUpload(index)"
            title="Upload image"
          >
            📷
          </div>

          <button
            v-if="item.imageUrl"
            type="button"
            style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--red);color:#fff;border:none;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;"
            @click="removeImage(index)"
          >×</button>
        </template>

        <input
          :id="`file-input-${index}`"
          type="file"
          accept="image/*"
          style="display:none;"
          @change="handleFileUpload(index, $event)"
        />
      </div>

      <!-- Text + YouTube URL inputs -->
      <div class="list-item-row__fields">
        <input
          :id="`item-input-${index}`"
          :value="item.text"
          class="input"
          placeholder="Item name..."
          style="margin-bottom:0.35rem;"
          @input="updateItem(index, 'text', ($event.target as HTMLInputElement).value)"
          @keydown="handleItemKeydown(index, $event)"
        />
        <div style="position:relative;">
          <input
            :value="item.youtubeUrl"
            class="input"
            style="font-size:0.8rem; padding-left:1.75rem; color:var(--text-muted);"
            placeholder="YouTube URL (optional)..."
            @input="updateItem(index, 'youtubeUrl', ($event.target as HTMLInputElement).value)"
          />
          <span style="position:absolute;left:0.55rem;top:50%;transform:translateY(-50%);font-size:0.85rem;pointer-events:none;">▶</span>
          <span
            v-if="item.youtubeUrl && !extractYouTubeId(item.youtubeUrl)"
            style="position:absolute;right:0.55rem;top:50%;transform:translateY(-50%);font-size:0.75rem;color:var(--red);"
            title="Invalid YouTube URL"
          >✕</span>
          <span
            v-else-if="item.youtubeUrl && extractYouTubeId(item.youtubeUrl)"
            style="position:absolute;right:0.55rem;top:50%;transform:translateY(-50%);font-size:0.75rem;color:var(--green);"
          >✓</span>
        </div>
      </div>

      <!-- Move up/down + remove -->
      <div class="list-item-row__actions">
        <button
          type="button"
          class="btn btn--ghost btn--sm"
          :disabled="index === 0"
          @click="moveUp(index)"
          title="Move up"
        >↑</button>
        <button
          type="button"
          class="btn btn--ghost btn--sm"
          :disabled="index === items.length - 1"
          @click="moveDown(index)"
          title="Move down"
        >↓</button>
        <button
          type="button"
          class="btn btn--danger btn--sm"
          @click="removeItem(index)"
          title="Remove"
        >×</button>
      </div>
    </div>
  </div>
</template>
