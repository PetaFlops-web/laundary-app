import { request } from './api'

// SRS FR-01
export const registerUser = (payload) => request('/auth/register', { method: 'POST', body: payload })
// SRS FR-02: mengembalikan { accessToken, refreshToken }
export const loginUser = (payload) => request('/auth/login', { method: 'POST', body: payload })
// SRS FR-04
export const logoutUser = (refreshToken, token) =>
  request('/auth/logout', { method: 'POST', body: { refreshToken }, token })
