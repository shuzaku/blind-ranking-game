<script setup lang="ts">
defineProps<{
  message?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  mood?: 'neutral' | 'excited' | 'thinking' | 'celebrate' | 'shush'
  inline?: boolean
}>()
</script>

<template>
  <div class="owl-mascot" :class="[`owl-mascot--${size ?? 'md'}`, inline && 'owl-mascot--inline']">
    <div v-if="message && !inline" class="owl-bubble">
      {{ message }}
    </div>

    <div class="owl-wrap" :class="`owl--${mood ?? 'neutral'}`">
      <svg
        :width="size === 'sm' ? 64 : size === 'xl' ? 160 : size === 'lg' ? 140 : 96"
        :height="size === 'sm' ? 72 : size === 'xl' ? 180 : size === 'lg' ? 158 : 108"
        viewBox="0 0 96 108"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Body -->
        <ellipse cx="48" cy="70" rx="30" ry="32" fill="#7c3aed"/>
        <ellipse cx="48" cy="70" rx="24" ry="26" fill="#a855f7"/>

        <!-- Belly -->
        <ellipse cx="48" cy="76" rx="15" ry="18" fill="#c4b5fd"/>

        <!-- Wings -->
        <ellipse cx="18" cy="72" rx="12" ry="20" fill="#6d28d9" transform="rotate(-15 18 72)"/>
        <ellipse cx="78" cy="72" rx="12" ry="20" fill="#6d28d9" transform="rotate(15 78 72)"/>

        <!-- Tail feathers -->
        <ellipse cx="40" cy="100" rx="6" ry="10" fill="#6d28d9" transform="rotate(-10 40 100)"/>
        <ellipse cx="48" cy="102" rx="6" ry="10" fill="#5b21b6"/>
        <ellipse cx="56" cy="100" rx="6" ry="10" fill="#6d28d9" transform="rotate(10 56 100)"/>

        <!-- Head -->
        <ellipse cx="48" cy="38" rx="26" ry="26" fill="#7c3aed"/>
        <ellipse cx="48" cy="38" rx="22" ry="22" fill="#a855f7"/>

        <!-- Ear tufts -->
        <polygon points="26,18 20,4 32,14" fill="#6d28d9"/>
        <polygon points="70,18 76,4 64,14" fill="#6d28d9"/>

        <!-- Eyes -->
        <circle cx="36" cy="36" r="10" fill="white"/>
        <circle cx="60" cy="36" r="10" fill="white"/>
        <circle cx="36" cy="36" r="7" fill="#06b6d4"/>
        <circle cx="60" cy="36" r="7" fill="#06b6d4"/>
        <circle cx="36" cy="36" r="4" fill="#0d0d1e"/>
        <circle cx="60" cy="36" r="4" fill="#0d0d1e"/>
        <!-- Eye shine -->
        <circle cx="39" cy="33" r="2" fill="white"/>
        <circle cx="63" cy="33" r="2" fill="white"/>

        <!-- Beak -->
        <polygon points="48,42 43,50 53,50" fill="#f59e0b"/>

        <!-- Feet -->
        <line x1="38" y1="100" x2="30" y2="108" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
        <line x1="38" y1="100" x2="34" y2="108" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
        <line x1="38" y1="100" x2="38" y2="108" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
        <line x1="58" y1="100" x2="58" y2="108" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
        <line x1="58" y1="100" x2="62" y2="108" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
        <line x1="58" y1="100" x2="66" y2="108" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>

        <!-- Excited: eyebrows up -->
        <template v-if="mood === 'excited' || mood === 'celebrate'">
          <path d="M28 24 Q36 19 44 24" stroke="#c4b5fd" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <path d="M52 24 Q60 19 68 24" stroke="#c4b5fd" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        </template>

        <!-- Thinking: one brow raised -->
        <template v-if="mood === 'thinking'">
          <path d="M28 26 Q36 22 44 26" stroke="#c4b5fd" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <path d="M52 24 Q60 21 68 26" stroke="#c4b5fd" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        </template>

        <!-- Shush: wing raised to beak -->
        <template v-if="mood === 'shush'">
          <line x1="52" y1="46" x2="62" y2="40" stroke="#c4b5fd" stroke-width="3" stroke-linecap="round"/>
        </template>
      </svg>
    </div>
  </div>
</template>
