/**
 * Página de gestión de categorías y subcategorías del comedor
 * (dbo.categoria / dbo.sub_categoria en SUMMA), como árbol:
 *   Bebidas
 *     ├── Aguas
 *     ├── Gaseosas
 *     └── Lácteos
 *
 * Renombrar actualiza en cascada los artículos que usan esa categoría/
 * subcategoría. Borrar se bloquea si hay artículos asociados — ambas
 * reglas las aplica el backend (SPs en SUMMA), acá solo se muestra el
 * mensaje de error que devuelva.
 */
import { useState, useEffect } from 'react'
import {
  Tree, Button, Modal, Form, Input, Space, Typography,
  Popconfirm, message, Empty,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, FolderOutlined, TagOutlined,
} from '@ant-design/icons'
import { categoriaService } from '../services/categoriaService'

const { Title, Text } = Typography

const MODAL_TITLES = {
  'crear-categoria':     'Nueva categoría',
  'renombrar-categoria': 'Renombrar categoría',
  'crear-sub':           'Nueva subcategoría',
  'renombrar-sub':       'Renombrar subcategoría',
}

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState([])  // [{ categoria, subCategorias: [...] }]
  const [loading, setLoading]       = useState(false)
  const [modalOpen, setModalOpen]   = useState(false)
  const [modalConfig, setModalConfig] = useState(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      setCategorias(await categoriaService.getAll())
    } catch (e) {
      message.error(e.response?.data?.detail || 'Error al cargar categorías.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openModal = (config) => {
    setModalConfig(config)
    form.resetFields()
    if (config.initialValue) form.setFieldsValue({ nombre: config.initialValue })
    setModalOpen(true)
  }

  const handleSave = async () => {
    const { nombre } = await form.validateFields()
    try {
      if (modalConfig.mode === 'crear-categoria') {
        await categoriaService.create(nombre)
        message.success('Categoría creada.')
      } else if (modalConfig.mode === 'renombrar-categoria') {
        await categoriaService.rename(modalConfig.categoria, nombre)
        message.success('Categoría renombrada.')
      } else if (modalConfig.mode === 'crear-sub') {
        await categoriaService.createSubCategoria(modalConfig.categoria, nombre)
        message.success('Subcategoría creada.')
      } else if (modalConfig.mode === 'renombrar-sub') {
        await categoriaService.renameSubCategoria(modalConfig.categoria, modalConfig.subCategoria, nombre)
        message.success('Subcategoría renombrada.')
      }
      setModalOpen(false)
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Error al guardar.')
    }
  }

  const handleDeleteCategoria = async (categoria) => {
    try {
      await categoriaService.delete(categoria)
      message.success('Categoría eliminada.')
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Error al eliminar la categoría.')
    }
  }

  const handleDeleteSub = async (categoria, subCategoria) => {
    try {
      await categoriaService.deleteSubCategoria(categoria, subCategoria)
      message.success('Subcategoría eliminada.')
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Error al eliminar la subcategoría.')
    }
  }

  // ── Estructura que espera <Tree> — cada título trae sus propias acciones ─────
  const treeData = categorias.map((c) => ({
    key: `cat:${c.categoria}`,
    title: (
      <Space>
        <FolderOutlined style={{ color: '#d48806' }} />
        <Text strong>{c.categoria}</Text>
        <Button
          size="small" type="text" icon={<PlusOutlined />} title="Agregar subcategoría"
          onClick={(e) => { e.stopPropagation(); openModal({ mode: 'crear-sub', categoria: c.categoria }) }}
        />
        <Button
          size="small" type="text" icon={<EditOutlined />} title="Renombrar categoría"
          onClick={(e) => {
            e.stopPropagation()
            openModal({ mode: 'renombrar-categoria', categoria: c.categoria, initialValue: c.categoria })
          }}
        />
        <Popconfirm
          title="¿Eliminar esta categoría?"
          description="Se rechaza si tiene artículos asociados (a esta categoría o a alguna de sus subcategorías)."
          onConfirm={() => handleDeleteCategoria(c.categoria)}
          okText="Eliminar" okButtonProps={{ danger: true }} cancelText="Cancelar"
        >
          <Button size="small" type="text" danger icon={<DeleteOutlined />} title="Eliminar categoría" onClick={(e) => e.stopPropagation()} />
        </Popconfirm>
      </Space>
    ),
    children: c.subCategorias.map((sc) => ({
      key: `sub:${c.categoria}:${sc}`,
      isLeaf: true,
      title: (
        <Space>
          <TagOutlined style={{ color: '#8c8c8c' }} />
          <Text>{sc}</Text>
          <Button
            size="small" type="text" icon={<EditOutlined />} title="Renombrar subcategoría"
            onClick={(e) => {
              e.stopPropagation()
              openModal({ mode: 'renombrar-sub', categoria: c.categoria, subCategoria: sc, initialValue: sc })
            }}
          />
          <Popconfirm
            title="¿Eliminar esta subcategoría?"
            description="Se rechaza si tiene artículos asociados."
            onConfirm={() => handleDeleteSub(c.categoria, sc)}
            okText="Eliminar" okButtonProps={{ danger: true }} cancelText="Cancelar"
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} title="Eliminar subcategoría" onClick={(e) => e.stopPropagation()} />
          </Popconfirm>
        </Space>
      ),
    })),
  }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Categorías</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal({ mode: 'crear-categoria' })}>
          Nueva categoría
        </Button>
      </div>

      {!loading && categorias.length === 0 ? (
        <Empty description="No hay categorías creadas todavía." />
      ) : (
        <Tree treeData={treeData} defaultExpandAll blockNode selectable={false} />
      )}

      <Modal
        title={modalConfig ? MODAL_TITLES[modalConfig.mode] : ''}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Guardar"
        destroyOnClose
      >
        {modalConfig?.mode === 'crear-sub' && (
          <Text type="secondary">En la categoría: <Text strong>{modalConfig.categoria}</Text></Text>
        )}
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'El nombre es requerido.' }]}>
            <Input autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
