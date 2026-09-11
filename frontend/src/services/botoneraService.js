import api from './api'

export const botoneraService = {
  // ── Botoneras ─────────────────────────────────────────────
  getAll: async () => {
    const { data } = await api.get('/botoneras')
    return data
  },
  create: async (botonera) => {
    const { data } = await api.post('/botoneras', botonera)
    return data
  },
  update: async (id, botonera) => {
    const { data } = await api.put(`/botoneras/${id}`, botonera)
    return data
  },
  delete: async (id) => {
    await api.delete(`/botoneras/${id}`)
  },

  // ── Botones ───────────────────────────────────────────────
  getBotones: async (botoneraId) => {
    const { data } = await api.get(`/botoneras/${botoneraId}/botones`)
    return data
  },
  createBoton: async (botoneraId, boton) => {
    const { data } = await api.post(`/botoneras/${botoneraId}/botones`, { ...boton, botonera_id: botoneraId })
    return data
  },
  updateBoton: async (botoneraId, botonId, boton) => {
    const { data } = await api.put(`/botoneras/${botoneraId}/botones/${botonId}`, boton)
    return data
  },
  deleteBoton: async (botoneraId, botonId) => {
    await api.delete(`/botoneras/${botoneraId}/botones/${botonId}`)
  },

  // ── Opciones de botón combo ───────────────────────────────
  getOpciones: async (botoneraId, botonId) => {
    const { data } = await api.get(`/botoneras/${botoneraId}/botones/${botonId}/opciones`)
    return data
  },
  createOpcion: async (botoneraId, botonId, opcion) => {
    const { data } = await api.post(`/botoneras/${botoneraId}/botones/${botonId}/opciones`, opcion)
    return data
  },
  updateOpcion: async (botoneraId, botonId, opcionId, opcion) => {
    const { data } = await api.put(`/botoneras/${botoneraId}/botones/${botonId}/opciones/${opcionId}`, opcion)
    return data
  },
  deleteOpcion: async (botoneraId, botonId, opcionId) => {
    await api.delete(`/botoneras/${botoneraId}/botones/${botonId}/opciones/${opcionId}`)
  },
}
