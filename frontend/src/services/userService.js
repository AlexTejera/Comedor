import api from './api'

export const userService = {
  getAll: async () => {
    const { data } = await api.get('/users')
    return data
  },
  create: async (user) => {
    const { data } = await api.post('/users', user)
    return data
  },
  update: async (id, user) => {
    const { data } = await api.put(`/users/${id}`, user)
    return data
  },
  delete: async (id) => {
    await api.delete(`/users/${id}`)
  },
}
