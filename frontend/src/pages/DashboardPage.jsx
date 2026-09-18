import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Typography, Tag, Spin, Button } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  AppstoreOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { logService } from '../services/logService'
import { botoneraService } from '../services/botoneraService'
import { conPrefijo } from '../utils/wafPrefix'
import dayjs from 'dayjs'

const { Title, Text } = Typography

export default function DashboardPage() {
  const [logs, setLogs] = useState([])
  const [botoneras, setBotoneras] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [logsData, botsData] = await Promise.all([
          logService.getLogs({ limit: 500 }),
          botoneraService.getAll(),
        ])
        setLogs(logsData.registros || [])
        setBotoneras(botsData || [])
      } catch {
        // silencioso
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const pedidos  = logs.filter(l => l.tipo === 'pedido')
  const exitosos = pedidos.filter(l => l.resultado === 'OK')
  const errores  = pedidos.filter(l => l.resultado === 'ERROR')
  const botActivas = botoneras.filter(b => b.activa)

  // Hora actual para mostrar botonera activa
  const ahora = dayjs().format('HH:mm')
  const botoneraActiva = botActivas.find(b => b.hora_inicio <= ahora && ahora <= b.hora_fin)

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>Dashboard</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Pedidos hoy"
              value={pedidos.length}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Exitosos"
              value={exitosos.length}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Con error"
              value={errores.length}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Botoneras activas"
              value={botActivas.length}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="Botonera en este momento">
            {botoneraActiva ? (
              <div>
                <Tag color="green" style={{ fontSize: 14 }}>Activa</Tag>
                <Text strong style={{ fontSize: 16, marginLeft: 8 }}>{botoneraActiva.nombre}</Text>
                <br />
                <Text type="secondary">{botoneraActiva.hora_inicio} – {botoneraActiva.hora_fin}</Text>
              </div>
            ) : (
              <Text type="secondary">No hay servicio activo en este horario ({ahora})</Text>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Acceso rápido">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button icon={<LinkOutlined />} href={conPrefijo('/')} target="_blank">Abrir Kiosko</Button>
              <Button href={conPrefijo('/admin/botoneras')}>Gestionar Botoneras</Button>
              <Button href={conPrefijo('/admin/logs')}>Ver Historial</Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
