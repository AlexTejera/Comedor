import { useState } from 'react'
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd'
import { UserOutlined, LockOutlined, CoffeeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const { Title, Text } = Typography

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async ({ username, password }) => {
    setLoading(true)
    setError('')
    try {
      await login(username, password)
      navigate('/admin')
    } catch {
      setError('Usuario o contraseña incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a2a4a 0%, #0d1b35 100%)',
    }}>
      <Card style={{ width: 380, borderRadius: 16 }} variant="outlined">
        <Space direction="vertical" size={24} style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <CoffeeOutlined style={{ fontSize: 40, color: '#1677ff' }} />
            <Title level={3} style={{ margin: '8px 0 0' }}>Panel de Administración</Title>
            <Text type="secondary">Sistema Comedor — Aluminios del Uruguay</Text>
          </div>

          {error && <Alert type="error" message={error} showIcon />}

          <Form layout="vertical" onFinish={handleSubmit} autoComplete="off">
            <Form.Item name="username" rules={[{ required: true, message: 'Ingresá tu usuario' }]}>
              <Input prefix={<UserOutlined />} placeholder="Usuario" size="large" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: 'Ingresá tu contraseña' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Contraseña" size="large" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                Ingresar
              </Button>
            </Form.Item>
          </Form>

          <Button type="link" size="small" onClick={() => navigate('/')}>
            ← Volver al kiosko
          </Button>
        </Space>
      </Card>
    </div>
  )
}
