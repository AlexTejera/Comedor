import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, Switch, Space, Typography, Tag, Popconfirm, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { userService } from '../services/userService'

const { Title } = Typography

export default function UsersPage() {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try { setUsers(await userService.getAll()) }
    catch { message.error('Error al cargar usuarios') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openModal = (user = null) => {
    setEditTarget(user)
    form.resetFields()
    if (user) form.setFieldsValue({ ...user, password: '' })
    setModalOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    if (editTarget && !values.password) delete values.password
    try {
      if (editTarget) {
        await userService.update(editTarget.id, values)
        message.success('Usuario actualizado')
      } else {
        await userService.create(values)
        message.success('Usuario creado')
      }
      setModalOpen(false)
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Error al guardar')
    }
  }

  const handleDelete = async (id) => {
    try {
      await userService.delete(id)
      message.success('Usuario eliminado')
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Error al eliminar')
    }
  }

  const columns = [
    { title: 'Usuario', dataIndex: 'username', key: 'username' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Rol', dataIndex: 'role', key: 'role', render: (v) => v === 'admin' ? <Tag color="blue">Admin</Tag> : <Tag>Usuario</Tag> },
    { title: 'Activo', dataIndex: 'is_active', key: 'is_active', render: (v) => v ? <Tag color="success">Sí</Tag> : <Tag>No</Tag> },
    {
      title: 'Acciones', key: 'acc',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="¿Eliminar este usuario?" onConfirm={() => handleDelete(r.id)} okText="Sí" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Usuarios del panel admin</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Nuevo usuario</Button>
      </div>

      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} />

      <Modal title={editTarget ? 'Editar usuario' : 'Nuevo usuario'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} okText="Guardar">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="username" label="Nombre de usuario" rules={[{ required: !editTarget }]}>
            <Input disabled={!!editTarget} />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label={editTarget ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'} rules={editTarget ? [] : [{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Rol" initialValue="user">
            <Select options={[{ value: 'admin', label: 'Administrador' }, { value: 'user', label: 'Usuario' }]} />
          </Form.Item>
          <Form.Item name="is_active" label="Activo" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
