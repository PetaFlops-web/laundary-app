<script setup>
import DrumArt from './DrumArt.vue'

defineProps({ heading: String, intro: String })

const facts = [
  'Reguler sekitar 3 hari, ekspres sekitar 24 jam',
  'Bayar online setelah cucian ditimbang',
  'Diantar ke rumah atau ambil sendiri di laundry',
]
</script>

<template>
  <div class="container-fluid p-0">
    <div class="row g-0 min-vh-100">
      <!-- Panel kiri (desktop) -->
      <aside class="col-lg-6 d-none d-lg-flex flex-column auth-left px-5 py-5">
        <div class="brand"><span class="logo">A</span>Achilla Laundry</div>
        <DrumArt />
        <div class="hero mt-auto">
          <h1 class="font-display">{{ heading }}</h1>
          <p class="text-ach-mid mt-3 mb-4">{{ intro }}</p>
          <ul class="list-unstyled d-grid gap-3 mb-0">
            <li v-for="f in facts" :key="f" class="d-flex align-items-center gap-3">
              <span class="tick">
                <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6.3l2.4 2.4L9.6 3.6" fill="none" stroke="#0B3B49" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </span>
              {{ f }}
            </li>
          </ul>
        </div>
      </aside>

      <!-- Panel form -->
      <main class="col-12 col-lg-6 d-flex flex-column">
        <div class="d-lg-none auth-left px-4 py-3">
          <div class="brand"><span class="logo">A</span>Achilla Laundry</div>
        </div>
        <div class="flex-grow-1 d-flex align-items-center justify-content-center px-4 py-5">
          <div class="form-wrap w-100"><slot /></div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.auth-left { background: var(--ach-primary); position: relative; overflow: hidden; }
.brand { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; font-weight: 600; font-size: 1.25rem; }
.logo { width: 40px; height: 40px; border-radius: 50%; background: var(--ach-deep); color: var(--ach-primary); display: grid; place-items: center; font-family: 'Lora', serif; font-weight: 700; font-size: 1.35rem; }
.hero { position: relative; z-index: 1; max-width: 520px; }
h1 { font-size: 2.9rem; line-height: 1.15; letter-spacing: -0.5px; }
.tick { width: 22px; height: 22px; border-radius: 50%; background: #fff; display: grid; place-items: center; flex: none; }
.form-wrap { max-width: 440px; }
</style>
