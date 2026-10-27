<script setup>
import { ref } from 'vue'

defineProps({
  modelValue: { type: String, default: '' },
  id: { type: String, required: true },
  label: { type: String, default: 'Kata sandi' },
  placeholder: String,
  error: String,
  autocomplete: String,
})
defineEmits(['update:modelValue'])
const show = ref(false)
</script>

<template>
  <div class="mb-3">
    <label :for="id" class="form-label fw-medium">{{ label }}</label>
    <div class="position-relative">
      <input
        :id="id" class="form-control pe-5" :class="{ 'is-invalid': error }"
        :type="show ? 'text' : 'password'" :value="modelValue" :placeholder="placeholder"
        :autocomplete="autocomplete" :aria-invalid="!!error"
        @input="$emit('update:modelValue', $event.target.value)"
      />
      <button
        type="button" class="toggle btn btn-link p-0" :aria-label="show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'"
        @click="show = !show"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3F7F90" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <template v-if="!show"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></template>
          <template v-else><path d="M3 3l18 18" /><path d="M10.6 6.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 4-.8" /></template>
        </svg>
      </button>
    </div>
    <div v-if="error" class="invalid-feedback d-block">{{ error }}</div>
  </div>
</template>

<style scoped>
.toggle { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); line-height: 1; }
</style>
