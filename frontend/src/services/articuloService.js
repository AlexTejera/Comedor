import api from './api'

export const articuloService = {
  getAll: async () => {
    const { data } = await api.get('/articulos')
    return data
  },
  create: async (articulo) => {
    const { data } = await api.post('/articulos', articulo)
    return data
  },
  /** codigo y nombre no se envían — son inmutables (ver ArticuloUpdate en el backend). */
  update: async (codigo, articulo) => {
    const { data } = await api.put(`/articulos/${encodeURIComponent(codigo)}`, articulo)
    return data
  },
  delete: async (codigo) => {
    await api.delete(`/articulos/${encodeURIComponent(codigo)}`)
  },
  getLimites: async (codigo) => {
    const { data } = await api.get(`/articulos/${encodeURIComponent(codigo)}/limites`)
    return data
  },
  guardarLimite: async (codigo, limite) => {
    const { data } = await api.post(`/articulos/${encodeURIComponent(codigo)}/limites`, limite)
    return data
  },
  eliminarLimite: async (codigo, enUltimasXHs) => {
    await api.delete(`/articulos/${encodeURIComponent(codigo)}/limites/${enUltimasXHs}`)
  },
}
