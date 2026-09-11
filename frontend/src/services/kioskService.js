import api from './api'

export const kioskService = {
  /** Valida el número de empleado contra SUMMA y retorna botonera activa */
  validarEmpleado: async (numeroEmpleado) => {
    const { data } = await api.post('/kiosko/validar-empleado', {
      numero_empleado: numeroEmpleado,
    })
    return data
  },

  /** Envía el pedido a SUMMA para confirmación */
  confirmarPedido: async (numeroEmpleado, nombreEmpleado, items) => {
    const { data } = await api.post('/kiosko/confirmar-pedido', {
      numero_empleado: numeroEmpleado,
      nombre_empleado: nombreEmpleado,
      items,
    })
    return data
  },

  /** Obtiene la botonera activa para el horario actual */
  getBotoneraActiva: async () => {
    const { data } = await api.get('/kiosko/botonera-activa')
    return data
  },

  /** Obtiene la configuración pública del kiosko (sin autenticación) */
  getConfig: async () => {
    const { data } = await api.get('/kiosko/config')
    return data
  },

  /** Obtiene el costo total de los artículos pendientes de contabilizar */
  getTotalConsumo: async (numeroEmpleado) => {
    const { data } = await api.get(`/kiosko/total-consumo/${numeroEmpleado}`)
    return data
  },
}
