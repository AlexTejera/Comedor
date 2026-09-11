import api from './api'

export const backupService = {
  getAll: async () => {
    const { data } = await api.get('/backup')
    return data
  },
  create: async () => {
    const { data } = await api.post('/backup/crear')
    return data
  },
  restore: async (filename) => {
    const { data } = await api.post(`/backup/restaurar/${filename}`)
    return data
  },
  delete: async (filename) => {
    await api.delete(`/backup/${filename}`)
  },
  getDownloadUrl: (filename) => `/api/backup/descargar/${filename}`,
}
