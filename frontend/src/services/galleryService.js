import api from './api'

export const galleryService = {
  getAll: async () => {
    const { data } = await api.get('/gallery')
    return data
  },
  upload: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post('/gallery', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
  delete: async (id) => {
    await api.delete(`/gallery/${id}`)
  },
}
