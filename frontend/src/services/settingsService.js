import api from './api'

export const settingsService = {
  getAll: async () => {
    const { data } = await api.get('/settings')
    return data
  },
  updateBulk: async (settings) => {
    const { data } = await api.put('/settings', { settings })
    return data
  },
  testConnection: async () => {
    const { data } = await api.post('/settings/test-connection')
    return data
  },
}
