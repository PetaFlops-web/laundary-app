<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  id: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, default: 'text' },
  as: { type: String, default: 'input' }, // 'input' | 'textarea'
  placeholder: String,
  error: String,
  hint: String,
  counter: String,
  autocomplete: String,
  maxlength: Number,
})
defineEmits(['update:modelValue'])
</script>

<template>
  <div class="mb-3">
    <label :for="id" class="form-label fw-medium">{{ label }}</label>
    <textarea
      v-if="as === 'textarea'"
      :id="id" class="form-control" :class="{ 'is-invalid': error }" rows="3"
      :value="modelValue" :placeholder="placeholder" :maxlength="maxlength" :aria-invalid="!!error"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <input
      v-else
      :id="id" class="form-control" :class="{ 'is-invalid': error }" :type="type"
      :value="modelValue" :placeholder="placeholder" :autocomplete="autocomplete" :aria-invalid="!!error"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <div v-if="error" class="invalid-feedback d-block">{{ error }}</div>
    <div v-if="hint || counter" class="d-flex justify-content-between gap-3 small text-ach-mid mt-1">
      <span>{{ hint }}</span><span>{{ counter }}</span>
    </div>
  </div>
</template>
