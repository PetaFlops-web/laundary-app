<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '../components/AuthLayout.vue'
import TextField from '../components/TextField.vue'
import PasswordField from '../components/PasswordField.vue'
import { registerUser } from '../services/authService'
import { validateRegister, mapServerErrors, ADDRESS_MAX } from '../utils/validators'

const router = useRouter()
const form = reactive({ name: '', email: '', phone: '', address: '', password: '' })
const errors = ref({})
const serverError = ref('')
const loading = ref(false)

async function submit() {
  serverError.value = ''
  errors.value = validateRegister(form)
  if (Object.keys(errors.value).length) return

  loading.value = true
  try {
    await registerUser({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      password: form.password,
    })
    router.replace({ name: 'login', query: { registered: '1' } })
  } catch (e) {
    if (e.status === 409) serverError.value = 'Email atau nomor telepon sudah terdaftar.'
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
    heading="Daftar sekali, pesan kapan saja."
    intro="Alamat yang kamu isi dipakai sebagai alamat jemput dan antar, jadi tidak perlu mengetik ulang di setiap pesanan."
  >
    <h2 class="font-display fs-2 mb-1">Buat akun baru</h2>
    <p class="text-ach-mid mb-4">Isi data berikut untuk mulai memesan.</p>

    <div v-if="serverError" class="alert alert-danger" role="alert">{{ serverError }}</div>

    <form novalidate @submit.prevent="submit">
      <TextField id="name" v-model="form.name" label="Nama lengkap" placeholder="Nama sesuai identitas" autocomplete="name" :error="errors.name" />
      <TextField id="email" v-model="form.email" label="Email" type="email" placeholder="nama@email.com" autocomplete="email" :error="errors.email" />
      <TextField id="phone" v-model="form.phone" label="Nomor telepon atau WhatsApp" type="tel" placeholder="08xxxxxxxxxx" autocomplete="tel" :error="errors.phone" />
      <TextField
        id="address" v-model="form.address" as="textarea" label="Alamat lengkap"
        placeholder="Nama jalan, nomor rumah atau kos, kecamatan" :maxlength="ADDRESS_MAX"
        hint="Dipakai untuk jemput dan antar. Bisa diubah saat memesan."
        :counter="`${form.address.length}/${ADDRESS_MAX}`" :error="errors.address"
      />
      <PasswordField id="password" v-model="form.password" placeholder="Buat kata sandi" autocomplete="new-password" :error="errors.password" />

      <button class="btn btn-primary w-100 mt-2" type="submit" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
        {{ loading ? 'Memproses...' : 'Buat akun' }}
      </button>
    </form>

    <p class="text-center text-ach-mid mt-4 mb-0 small">
      Sudah punya akun? <RouterLink :to="{ name: 'login' }">Masuk</RouterLink>
    </p>
  </AuthLayout>
</template>
