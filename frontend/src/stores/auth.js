import { reactive } from 'vue'
import { loginUser, logoutUser } from '../services/authService'

const KEY = 'achilla_tokens'
const saved = JSON.parse(localStorage.getItem(KEY) || 'null')

export const auth = reactive({
  accessToken: saved?.accessToken ?? null,
  refreshToken: saved?.refreshToken ?? null,
  get isLoggedIn() {
    return !!this.accessToken
  },
  async login(email, password) {
    const { accessToken, refreshToken } = await loginUser({ email, password })
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    localStorage.setItem(KEY, JSON.stringify({ accessToken, refreshToken }))
  },
  async logout() {
    try {
      await logoutUser(this.refreshToken, this.accessToken)
    } catch {
      /* tetap keluar di sisi klien */
    }
    this.accessToken = this.refreshToken = null
    localStorage.removeItem(KEY)
  },
})
