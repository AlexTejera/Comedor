import api from './api'

export const categoriaService = {
  /** Árbol completo: [{ categoria, subCategorias: [...] }, ...] */
  getAll: async () => {
    const { data } = await api.get('/categorias')
    return data
  },
  create: async (categoria) => {
    const { data } = await api.post('/categorias', { categoria })
    return data
  },
  rename: async (categoria, categoriaNueva) => {
    const { data } = await api.put(`/categorias/${encodeURIComponent(categoria)}`, { categoria_nueva: categoriaNueva })
    return data
  },
  delete: async (categoria) => {
    await api.delete(`/categorias/${encodeURIComponent(categoria)}`)
  },

  createSubCategoria: async (categoria, subCategoria) => {
    const { data } = await api.post(
      `/categorias/${encodeURIComponent(categoria)}/subcategorias`,
      { sub_categoria: subCategoria },
    )
    return data
  },
  renameSubCategoria: async (categoria, subCategoria, subCategoriaNueva) => {
    const { data } = await api.put(
      `/categorias/${encodeURIComponent(categoria)}/subcategorias/${encodeURIComponent(subCategoria)}`,
      { sub_categoria_nueva: subCategoriaNueva },
    )
    return data
  },
  deleteSubCategoria: async (categoria, subCategoria) => {
    await api.delete(`/categorias/${encodeURIComponent(categoria)}/subcategorias/${encodeURIComponent(subCategoria)}`)
  },
}
