import { useState, useEffect } from 'react'
import { Form, Input, InputNumber, Button, Card, Typography, Alert, Space, Divider, Switch, message } from 'antd'
import { SaveOutlined, ApiOutlined } from '@ant-design/icons'
import { settingsService } from '../services/settingsService'

const { Title, Text } = Typography

export default function SettingsPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await settingsService.getAll()
        const values = {}
        settings.forEach(s => {
          // mostrar_numpad se almacena como "true"/"false" pero Switch necesita boolean
          if (s.key === 'mostrar_numpad') values[s.key] = s.value !== 'false'
          else values[s.key] = s.value
        })
        form.setFieldsValue(values)
      } catch {
        message.error('Error al cargar configuración')
      }
    }
    load()
  }, [form])

  const handleSave = async () => {
    const raw = form.getFieldsValue()
    // Convertir boolean de Switch a string para el backend
    const values = {
      ...raw,
      mostrar_numpad: raw.mostrar_numpad !== false ? 'true' : 'false',
    }
    setLoading(true)
    try {
      await settingsService.updateBulk(values)
      message.success('Configuración guardada correctamente')
    } catch {
      message.error('Error al guardar configuración')
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    // Guardar primero antes de testear
    const raw = form.getFieldsValue()
    const values = {
      ...raw,
      mostrar_numpad: raw.mostrar_numpad !== false ? 'true' : 'false',
    }
    setTesting(true)
    setTestResult(null)
    try {
      await settingsService.updateBulk(values)
      const result = await settingsService.testConnection()
      setTestResult(result)
    } catch {
      setTestResult({ ok: false, mensaje: 'Error al intentar la conexión.' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <Title level={4} style={{ marginBottom: 24 }}>Configuración del sistema</Title>

      <Form form={form} layout="vertical">

        <Card title="🔌 Conexión al servidor SUMMA (MSSQL)" style={{ marginBottom: 16 }}>
          <Form.Item name="summa_server" label="Servidor (IP o hostname)">
            <Input placeholder="192.168.1.100" />
          </Form.Item>
          <Form.Item name="summa_port" label="Puerto">
            <Input placeholder="1433" />
          </Form.Item>
          <Form.Item name="summa_database" label="Base de datos">
            <Input placeholder="Comedor" />
          </Form.Item>
          <Form.Item name="summa_user" label="Usuario SQL Server">
            <Input placeholder="sa" />
          </Form.Item>
          <Form.Item name="summa_password" label="Contraseña">
            <Input.Password placeholder="••••••••" />
          </Form.Item>
          <Form.Item name="summa_driver" label="Driver ODBC">
            <Input placeholder="ODBC Driver 18 for SQL Server" />
          </Form.Item>

          {testResult && (
            <Alert
              type={testResult.ok ? 'success' : 'error'}
              message={testResult.mensaje}
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}

          <Button
            icon={<ApiOutlined />}
            onClick={handleTest}
            loading={testing}
          >
            Probar conexión
          </Button>
        </Card>

        <Card title="🖥️ Kiosko" style={{ marginBottom: 16 }}>
          <Form.Item
            name="mostrar_numpad"
            label="Mostrar teclado numérico en pantalla de login"
            valuePropName="checked"
            help="Si está desactivado, los empleados ingresan su número desde el teclado físico y presionan Enter"
          >
            <Switch checkedChildren="Visible" unCheckedChildren="Oculto" />
          </Form.Item>
        </Card>

        <Card title="📋 Historial" style={{ marginBottom: 16 }}>
          <Form.Item
            name="log_max_records"
            label="Máximo de registros en el historial"
            help="Los registros más antiguos se eliminan automáticamente al superar este límite"
          >
            <Input type="number" min={100} max={10000} />
          </Form.Item>
        </Card>

        <Button
          type="primary"
          icon={<SaveOutlined />}
          size="large"
          onClick={handleSave}
          loading={loading}
        >
          Guardar configuración
        </Button>
      </Form>
    </div>
  )
}
