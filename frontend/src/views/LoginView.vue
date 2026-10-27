<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '../components/AuthLayout.vue'
import TextField from '../components/TextField.vue'
import PasswordField from '../components/PasswordField.vue'
import { auth } from '../stores/auth'
import { validateLogin, mapServerErrors } from '../utils/validators'

const route = useRoute()
const router = useRouter()
const form = reactive({ email: '', password: '' })
const errors = ref({})
const serverError = ref('')
const loading = ref(false)
const justRegistered = route.query.registered === '1'

async function submit() {
  serverError.value = ''
  errors.value = validateLogin(form)
  if (Object.keys(errors.value).length) return

  loading.value = true
  try {
    await auth.login(form.email.trim(), form.password)
    router.replace(route.query.redirect || { name: 'home' })
  } catch (e) {
    if (e.status === 401) serverError.value = 'Email atau kata sandi tidak sesuai.'
    else if (e.status === 422) errors.value = mapServerErrors(e.data)
    else if (e.status === 429) serverError.value = 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.'
    else serverError.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout
    heading="Cucian bersih, tinggal pilih diantar atau diambil."
    intro="Masuk untuk memesan penjemputan, memantau status cucian, dan membayar online."
  >
    <h2 class="font-display fs-2 mb-1">Masuk ke akun</h2>
    <p class="text-ach-mid mb-4">Gunakan email yang kamu daftarkan.</p>

    <div v-if="justRegistered" class="alert alert-success" role="status">Akun berhasil dibuat. Silakan masuk.</div>
    <div v-if="serverError" class="alert alert-danger" role="alert">{{ serverError }}</div>

    <form novalidate @submit.prevent="submit">
      <TextField id="email" v-model="form.email" label="Email" type="email" placeholder="nama@email.com" autocomplete="email" :error="errors.email" />
      <PasswordField id="password" v-model="form.password" placeholder="Masukkan kata sandi" autocomplete="current-password" :error="errors.password" />

      <div class="text-end mb-3 small">
        <!-- Aktif setelah FR-06 (lupa kata sandi) dikerjakan -->
        <a href="#" @click.prevent>Lupa kata sandi?</a>
      </div>

      <button class="btn btn-primary w-100" type="submit" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
        {{ loading ? 'Memproses...' : 'Masuk' }}
      </button>
    </form>

    <p class="text-center text-ach-mid mt-4 mb-2 small">
      Belum punya akun? <RouterLink :to="{ name: 'register' }">Daftar sekarang</RouterLink>
    </p>
   
  </AuthLayout>
</template>
