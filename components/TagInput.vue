<script setup lang="ts">
const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [string[]]
}>()

const inputVal = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

const tags = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

function addTag() {
  const raw = inputVal.value.trim().toLowerCase()
  if (!raw || tags.value.includes(raw)) {
    inputVal.value = ''
    return
  }
  tags.value = [...tags.value, raw]
  inputVal.value = ''
}

function removeTag(index: number) {
  tags.value = tags.value.filter((_, i) => i !== index)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
    e.preventDefault()
    addTag()
  } else if (e.key === 'Backspace' && inputVal.value === '' && tags.value.length > 0) {
    removeTag(tags.value.length - 1)
  }
}

function onBlur() {
  if (inputVal.value.trim()) addTag()
}
</script>

<template>
  <div class="tag-input" @click="inputEl?.focus()">
    <span
      v-for="(tag, i) in tags"
      :key="tag"
      class="tag-pill"
    >
      {{ tag }}
      <button type="button" class="tag-pill__remove" @click.stop="removeTag(i)">×</button>
    </span>
    <input
      ref="inputEl"
      v-model="inputVal"
      class="tag-input__field"
      placeholder="Add tag…"
      @keydown="onKeydown"
      @blur="onBlur"
    />
  </div>
  <p class="tag-input__hint">Press Enter or comma to add a tag</p>
</template>

<style scoped>
.tag-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0.45rem 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: text;
  transition: border-color 0.15s;
}
.tag-input:focus-within {
  border-color: var(--accent);
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem 0.2rem 0.65rem;
  background: rgba(124, 58, 237, 0.18);
  border: 1px solid rgba(124, 58, 237, 0.4);
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #c4b5fd;
  white-space: nowrap;
}

.tag-pill__remove {
  background: none;
  border: none;
  cursor: pointer;
  color: #a78bfa;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  transition: color 0.1s;
}
.tag-pill__remove:hover { color: #fff; }

.tag-input__field {
  flex: 1;
  min-width: 100px;
  background: none;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 0.95rem;
  padding: 0.1rem 0;
}
.tag-input__field::placeholder { color: var(--text-dim); }

.tag-input__hint {
  font-size: 0.78rem;
  color: var(--text-dim);
  margin-top: 0.3rem;
}
</style>
