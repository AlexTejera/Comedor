import { useState, useEffect } from 'react'
import { Table, Tag, Select, Button, Typography, Space, Tooltip } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { logService } from '../services/logService'
import dayjs from 'dayjs'

const { Title } = Typography
const { Option } = Select

export default function LogsPage() {
  const [data, setData]       = useState({ total: 0, registros: [] })
  const [loading, setLoading] = useState(false)
  const [filtros, setFiltros] = useState({ tipo: undefined, resultado: undefined })
  const [page, setPage]       = useState(1)
  const PAGE_SIZE = 50

  const load = async (pg = page, flt = filtros) => {
    setLoading(true)
    try {
      const res = await logService.getLogs({
        skip: (pg - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        tipo: flt.tipo,
        resultado: flt.resultado,
      })
      setData(res)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleFilter = (key, value) => {
    const newFiltros = { ...filtros, [key]: value || undefined }
    setFiltros(newFiltros)
    setPage(1)
    load(1, newFiltros)
  }

  const columns = [
    {
      title: 'Fecha y hora',
      dataIndex: 'fecha_hora',
      key: 'fecha_hora',
      width: 160,
      render: (v) => dayjs(v).format('DD/MM/YY HH:mm:ss'),
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      width: 110,
      render: (v) => v === 'pedido'
        ? <Tag color="blue">Pedido</Tag>
        : <Tag color="default">Validación</Tag>,
    },
    {
      title: 'Empleado',
      key: 'empleado',
      width: 180,
      render: (_, r) => (
        <span>
          <strong>{r.empleado_cod}</strong>
          {r.nombre_empleado && <span style={{ color: '#888', marginLeft: 6 }}>{r.nombre_empleado}</span>}
        </span>
      ),
    },
    {
      title: 'Resultado',
      dataIndex: 'resultado',
      key: 'resultado',
      width: 90,
      render: (v) => v === 'OK'
        ? <Tag color="success">OK</Tag>
        : <Tag color="error">ERROR</Tag>,
    },
    {
      title: 'Mensaje',
      dataIndex: 'mensaje',
      key: 'mensaje',
      render: (v) => <span style={{ color: '#555', fontSize: 12 }}>{v}</span>,
    },
    {
      title: 'Ítems',
      dataIndex: 'items_json',
      key: 'items',
      width: 220,
      render: (v) => {
        try {
          const items = JSON.parse(v)
          if (!items.length) return <span style={{ color: '#aaa' }}>—</span>
          return (
            <Tooltip title={items.map(i => `${i.nombre || i.articulo} x${i.cantidad}`).join(', ')}>
              <span style={{ fontSize: 12, cursor: 'default' }}>
                {items.map(i => `${i.nombre || i.articulo} x${i.cantidad}`).join(', ')}
              </span>
            </Tooltip>
          )
        } catch {
          return <span style={{ color: '#aaa' }}>—</span>
        }
      },
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Historial de eventos</Title>
        <Button icon={<ReloadOutlined />} onClick={() => load()}>Actualizar</Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="Tipo"
          allowClear
          style={{ width: 150 }}
          onChange={(v) => handleFilter('tipo', v)}
        >
          <Option value="validacion">Validación</Option>
          <Option value="pedido">Pedido</Option>
        </Select>
        <Select
          placeholder="Resultado"
          allowClear
          style={{ width: 150 }}
          onChange={(v) => handleFilter('resultado', v)}
        >
          <Option value="OK">OK</Option>
          <Option value="ERROR">Error</Option>
        </Select>
      </Space>

      <Table
        dataSource={data.registros}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ x: 900 }}
        pagination={{
          total: data.total,
          pageSize: PAGE_SIZE,
          current: page,
          onChange: (pg) => { setPage(pg); load(pg) },
          showTotal: (t) => `${t} registros`,
          showSizeChanger: false,
        }}
      />
    </div>
  )
}
