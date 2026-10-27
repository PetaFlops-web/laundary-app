import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '../stores/auth'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true, title: 'Beranda' } },
    { path: '/login', name: 'login', component: LoginView, meta: { guestOnly: true, title: 'Masuk' } },
    { path: '/register', name: 'register', component: RegisterView, meta: { guestOnly: true, title: 'Daftar' } },
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && auth.isLoggedIn) return { name: 'home' }
})

router.afterEach((to) => {
  document.title = `${to.meta.title ?? 'Achilla Laundry'} | Achilla Laundry`
})

export default router
