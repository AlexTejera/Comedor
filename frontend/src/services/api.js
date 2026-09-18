import axios from 'axios'
import { conPrefijo } from '../utils/wafPrefix'

const api = axios.create({
  baseURL: conPrefijo('/api'),
  timeout: 15000,
})

// Inyectar token JWT en todas las requests (si existe)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Si el servidor devuelve 401, limpiar sesión y redirigir al login admin
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = conPrefijo('/admin/login')
    }
    return Promise.reject(error)
  }
)

export default api
