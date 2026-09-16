/**
 * Página de gestión de artículos del comedor (dbo.Articulos en SUMMA).
 *
 * Código y nombre son inmutables una vez creado el artículo (protege la
 * trazabilidad contable) — al editar, esos dos campos quedan deshabilitados.
 * Categoría/subcategoría se eligen de la sección "Categorías" (no texto libre).
 */
import { useState, useEffect } from 'react'
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, Switch,
  Space, Typography, Popconfirm, message, Alert, Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { articuloService } from '../services/articuloService'
import { categoriaService } from '../services/categoriaService'

const { Title } = Typography

export default function ArticulosPage() {
  const [articulos, setArticulos]   = useState([])
  const [categorias, setCategorias] = useState([])  // árbol [{ categoria, subCategorias }]
  const [loading, setLoading]       = useState(false)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [selectedCategoria, setSelectedCategoria] = useState(null)  // filtra el Select de subcategoría
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [arts, cats] = await Promise.all([articuloService.getAll(), categoriaService.getAll()])
      setArticulos(arts)
      setCategorias(cats)
    } catch (e) {
      message.error(e.response?.data?.detail || 'Error al cargar artículos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const subCategoriasDe = (categoria) =>
    categorias.find((c) => c.categoria === categoria)?.subCategorias || []

  const openModal = (articulo = null) => {
    setEditTarget(articulo)
    form.resetFields()
    if (articulo) {
      // El backend devuelve "subCategoria" (camelCase) en el listado, pero
      // el form/la API de creación/edición usan "sub_categoria" — se mapea acá.
      form.setFieldsValue({ ...articulo, sub_categoria: articulo.subCategoria })
      setSelectedCategoria(articulo.categoria)
    } else {
      setSelectedCategoria(null)
    }
    setModalOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    try {
      if (editTarget) {
        const { descripcion, categoria, sub_categoria, precio, habilitado } = values
        await articuloService.update(editTarget.codigo, { descripcion, categoria, sub_categoria, precio, habilitado })
        message.success('Artículo actualizado.')
      } else {
        await articuloService.create(values)
        message.success('Artículo creado.')
      }
      setModalOpen(false)
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Error al guardar el artículo.')
    }
  }

  const handleDelete = async (codigo) => {
    try {
      await articuloService.delete(codigo)
      message.success('Artículo eliminado.')
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Error al eliminar el artículo.')
    }
  }

  const columns = [
    { title: 'Código', dataIndex: 'codigo', key: 'codigo', width: 130 },
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre' },
    { title: 'Descripción', dataIndex: 'descripcion', key: 'descripcion', ellipsis: true },
    { title: 'Categoría', dataIndex: 'categoria', key: 'categoria', width: 140 },
    { title: 'Subcategoría', dataIndex: 'subCategoria', key: 'subCategoria', width: 140 },
    {
      title: 'Precio', dataIndex: 'precio', key: 'precio', width: 110, align: 'right',
      render: (v) => `$ ${Number(v).toFixed(2)}`,
    },
    {
      title: 'Habilitado', dataIndex: 'habilitado', key: 'habilitado', width: 100, align: 'center',
      render: (v) => v ? <Tag color="success">Sí</Tag> : <Tag>No</Tag>,
    },
    {
      title: 'Acciones', key: 'acc', width: 100,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm
            title="¿Eliminar este artículo?"
            description="No se puede deshacer. Se rechaza si ya tiene consumos registrados."
            onConfirm={() => handleDelete(r.codigo)}
            okText="Eliminar"
            okButtonProps={{ danger: true }}
            cancelText="Cancelar"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Artículos</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} disabled={categorias.length === 0}>
          Nuevo artículo
        </Button>
      </div>

      {!loading && categorias.length === 0 && (
        <Alert
          type="warning"
          showIcon
          message="No hay categorías cargadas todavía."
          description='Creá al menos una categoría y una subcategoría en la sección "Categorías" antes de agregar artículos.'
          style={{ marginBottom: 16 }}
        />
      )}

      <Table dataSource={articulos} columns={columns} rowKey="codigo" loading={loading} />

      <Modal
        title={editTarget ? `Editar artículo — ${editTarget.codigo}` : 'Nuevo artículo'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Guardar"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="codigo" label="Código"
            rules={[{ required: !editTarget, message: 'El código es requerido.' }]}
            extra={editTarget ? 'No se puede cambiar una vez creado el artículo.' : undefined}
          >
            <Input disabled={!!editTarget} />
          </Form.Item>
          <Form.Item
            name="nombre" label="Nombre"
            rules={[{ required: !editTarget, message: 'El nombre es requerido.' }]}
            extra={editTarget ? 'No se puede cambiar una vez creado el artículo.' : undefined}
          >
            <Input disabled={!!editTarget} />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="categoria" label="Categoría" rules={[{ required: true, message: 'Seleccioná una categoría.' }]}>
            <Select
              placeholder="Seleccionar categoría"
              options={categorias.map((c) => ({ value: c.categoria, label: c.categoria }))}
              onChange={(v) => {
                setSelectedCategoria(v)
                form.setFieldValue('sub_categoria', undefined)
              }}
            />
          </Form.Item>
          <Form.Item name="sub_categoria" label="Subcategoría" rules={[{ required: true, message: 'Seleccioná una subcategoría.' }]}>
            <Select
              placeholder={selectedCategoria ? 'Seleccionar subcategoría' : 'Elegí primero una categoría'}
              disabled={!selectedCategoria}
              options={subCategoriasDe(selectedCategoria).map((sc) => ({ value: sc, label: sc }))}
            />
          </Form.Item>
          <Form.Item name="precio" label="Precio" initialValue={0} rules={[{ required: true, message: 'El precio es requerido.' }]}>
            <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} addonBefore="$" />
          </Form.Item>
          <Form.Item name="habilitado" label="Habilitado" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="Sí" unCheckedChildren="No" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
