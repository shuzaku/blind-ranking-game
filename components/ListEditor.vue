<script setup lang="ts">
interface Item {
  text: string
  imageUrl: string
  _uploading?: boolean
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

function addItem() {
  items.value = [...items.value, { text: '', imageUrl: '' }]
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
  arr.splice(index + 1, 0, { text: '', imageUrl: '' })
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
      <button type="button" class="btn btn--ghost btn--sm" @click="addItem">+ Add Item</button>
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

      <!-- Image thumbnail / upload -->
      <div style="position:relative; flex-shrink:0;">
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

        <input
          :id="`file-input-${index}`"
          type="file"
          accept="image/*"
          style="display:none;"
          @change="handleFileUpload(index, $event)"
        />
      </div>

      <!-- Text input -->
      <div class="list-item-row__fields">
        <input
          :id="`item-input-${index}`"
          :value="item.text"
          class="input"
          placeholder="Item name..."
          @input="updateItem(index, 'text', ($event.target as HTMLInputElement).value)"
          @keydown="handleItemKeydown(index, $event)"
        />
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
