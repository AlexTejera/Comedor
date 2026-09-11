import { useState, useEffect } from 'react'
import { Table, Button, Popconfirm, Typography, Space, Alert, message } from 'antd'
import { PlusOutlined, DownloadOutlined, ReloadOutlined, DeleteOutlined, RollbackOutlined } from '@ant-design/icons'
import { backupService } from '../services/backupService'

const { Title, Text } = Typography

export default function BackupPage() {
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setBackups(await backupService.getAll()) }
    catch { message.error('Error al cargar backups') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await backupService.create()
      message.success(res.mensaje)
      load()
    } catch { message.error('Error al crear backup') }
    finally { setCreating(false) }
  }

  const handleRestore = async (filename) => {
    try {
      const res = await backupService.restore(filename)
      message.success(res.mensaje)
    } catch { message.error('Error al restaurar backup') }
  }

  const handleDelete = async (filename) => {
    try {
      await backupService.delete(filename)
      message.success('Backup eliminado')
      load()
    } catch { message.error('Error al eliminar backup') }
  }

  const columns = [
    { title: 'Archivo', dataIndex: 'nombre', key: 'nombre', render: (v) => <Text code>{v}</Text> },
    { title: 'Fecha', dataIndex: 'fecha', key: 'fecha', width: 180 },
    { title: 'Tamaño', dataIndex: 'tamaño_kb', key: 'size', width: 100, render: (v) => `${v} KB` },
    {
      title: 'Acciones', key: 'acc', width: 220,
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            href={backupService.getDownloadUrl(r.nombre)}
          >
            Descargar
          </Button>
          <Popconfirm
            title="¿Restaurar esta base de datos? Se sobreescribirá la actual."
            onConfirm={() => handleRestore(r.nombre)}
            okText="Restaurar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" icon={<RollbackOutlined />} warning="true">Restaurar</Button>
          </Popconfirm>
          <Popconfirm title="¿Eliminar este backup?" onConfirm={() => handleDelete(r.nombre)} okText="Sí" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Backup de base de datos</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>Actualizar</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} loading={creating}>
            Crear backup
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="Los backups contienen toda la configuración del sistema: botoneras, botones, usuarios y settings."
        style={{ marginBottom: 16 }}
      />

      <Alert
        type="warning"
        showIcon
        message="Al restaurar un backup, reiniciá el servicio para que los cambios tomen efecto completamente."
        style={{ marginBottom: 16 }}
      />

      <Table dataSource={backups} columns={columns} rowKey="nombre" loading={loading} />
    </div>
  )
}
