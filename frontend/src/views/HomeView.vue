<script setup>
import { useRouter } from 'vue-router'
import { auth } from '../stores/auth'

const router = useRouter()
async function logout() {
  await auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <!-- Halaman sementara: tujuan setelah login berhasil. Ganti dengan beranda sebenarnya. -->
  <div class="container py-5 text-center">
    <h1 class="font-display">Kamu sudah masuk</h1>
    <p class="text-ach-mid">Halaman ini sementara, sebagai tujuan setelah login.</p>
    <button class="btn btn-primary px-4" @click="logout">Keluar</button>
  </div>
</template>
