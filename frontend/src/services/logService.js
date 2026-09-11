import api from './api'

export const logService = {
  getLogs: async ({ skip = 0, limit = 100, tipo, resultado } = {}) => {
    const params = { skip, limit }
    if (tipo) params.tipo = tipo
    if (resultado) params.resultado = resultado
    const { data } = await api.get('/logs', { params })
    return data
  },
}
