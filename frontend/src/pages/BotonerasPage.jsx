import { useState, useEffect } from 'react'
import {
  Table, Button, Modal, Form, Input, InputNumber, Switch, Space,
  Typography, Tag, Drawer, ColorPicker, Popconfirm, message, Tooltip,
  Badge, Divider, Radio, List, Empty,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  AppstoreAddOutlined, AppstoreOutlined, UnorderedListOutlined,
} from '@ant-design/icons'
import { botoneraService } from '../services/botoneraService'

const { Title, Text } = Typography

export default function BotonerasPage() {
  const [botoneras, setBotoneras]           = useState([])
  const [loading, setLoading]               = useState(false)
  const [modalOpen, setModalOpen]           = useState(false)
  const [drawerOpen, setDrawerOpen]         = useState(false)
  const [editTarget, setEditTarget]         = useState(null)
  const [botoneraActual, setBotoneraActual] = useState(null)
  const [botones, setBotones]               = useState([])
  const [botonModal, setBotonModal]         = useState(false)
  const [editBoton, setEditBoton]           = useState(null)
  const [tipoBoton, setTipoBoton]           = useState('simple')
  // Modal de opciones (para botones combo)
  const [opcionesModal, setOpcionesModal]   = useState(false)
  const [botonComboActual, setBotonComboActual] = useState(null)
  const [opciones, setOpciones]             = useState([])
  const [opcionModal, setOpcionModal]       = useState(false)
  const [editOpcion, setEditOpcion]         = useState(null)
  const [formBotonera]  = Form.useForm()
  const [formBoton]     = Form.useForm()
  const [formOpcion]    = Form.useForm()

  const load = async () => {
    setLoading(true)
    try { setBotoneras(await botoneraService.getAll()) }
    catch { message.error('Error al cargar botoneras') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // ── CRUD Botoneras ────────────────────────────────────────
  const openBotoneraModal = (botonera = null) => {
    setEditTarget(botonera)
    formBotonera.resetFields()
    if (botonera) formBotonera.setFieldsValue(botonera)
    setModalOpen(true)
  }

  const saveBotoneraModal = async () => {
    const values = await formBotonera.validateFields()
    try {
      if (editTarget) {
        await botoneraService.update(editTarget.id, values)
        message.success('Botonera actualizada')
      } else {
        await botoneraService.create(values)
        message.success('Botonera creada')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      const detalle = err?.response?.data?.detail
      message.error({ content: detalle || 'Error al guardar botonera', duration: 8 })
    }
  }

  const deleteBotonera = async (id) => {
    try {
      await botoneraService.delete(id)
      message.success('Botonera eliminada')
      load()
    } catch { message.error('Error al eliminar') }
  }

  // ── Drawer de botones ─────────────────────────────────────
  const openDrawer = async (botonera) => {
    setBotoneraActual(botonera)
    try { setBotones(await botoneraService.getBotones(botonera.id)) }
    catch { message.error('Error al cargar botones') }
    setDrawerOpen(true)
  }

  const loadBotones = async () => {
    if (!botoneraActual) return
    try { setBotones(await botoneraService.getBotones(botoneraActual.id)) }
    catch { message.error('Error al cargar botones') }
  }

  // ── CRUD Botones ──────────────────────────────────────────
  const openBotonModal = (boton = null) => {
    setEditBoton(boton)
    const tipo = boton?.tipo || 'simple'
    setTipoBoton(tipo)
    formBoton.resetFields()
    if (boton) {
      formBoton.setFieldsValue({
        ...boton,
        color:    boton.color    || '#1677ff',
        fila:     boton.fila     ?? null,
        columna:  boton.columna  ?? null,
        col_span: boton.col_span ?? 1,
        row_span: boton.row_span ?? 1,
        tipo,
      })
    } else {
      formBoton.setFieldsValue({ tipo: 'simple' })
    }
    setBotonModal(true)
  }

  const saveBotonModal = async () => {
    const values = await formBoton.validateFields()
    const color = typeof values.color === 'string'
      ? values.color
      : values.color?.toHexString?.() || '#1677ff'
    const payload = {
      ...values,
      color,
      fila:     values.fila    || null,
      columna:  values.columna || null,
      col_span: values.col_span || 1,
      row_span: values.row_span || 1,
      // Los combos no tienen producto_codigo propio (el código va en cada opción)
      producto_codigo: values.tipo === 'combo' ? '' : (values.producto_codigo || ''),
    }
    try {
      if (editBoton) {
        await botoneraService.updateBoton(botoneraActual.id, editBoton.id, payload)
        message.success('Botón actualizado')
      } else {
        await botoneraService.createBoton(botoneraActual.id, { ...payload, botonera_id: botoneraActual.id })
        message.success('Botón creado')
      }
      setBotonModal(false)
      loadBotones()
    } catch (err) {
      const detalle = err?.response?.data?.detail
      message.error({ content: detalle || 'Error al guardar botón', duration: 8 })
    }
  }

  const deleteBoton = async (botonId) => {
    try {
      await botoneraService.deleteBoton(botoneraActual.id, botonId)
      message.success('Botón eliminado')
      loadBotones()
    } catch { message.error('Error al eliminar botón') }
  }

  // ── Modal de opciones (combo) ─────────────────────────────
  const openOpcionesModal = async (boton) => {
    setBotonComboActual(boton)
    try { setOpciones(await botoneraService.getOpciones(botoneraActual.id, boton.id)) }
    catch { message.error('Error al cargar opciones') }
    setOpcionesModal(true)
  }

  const loadOpciones = async () => {
    if (!botonComboActual) return
    try { setOpciones(await botoneraService.getOpciones(botoneraActual.id, botonComboActual.id)) }
    catch { message.error('Error al cargar opciones') }
  }

  const openOpcionModal = (opcion = null) => {
    setEditOpcion(opcion)
    formOpcion.resetFields()
    if (opcion) formOpcion.setFieldsValue(opcion)
    setOpcionModal(true)
  }

  const saveOpcionModal = async () => {
    const values = await formOpcion.validateFields()
    try {
      if (editOpcion) {
        await botoneraService.updateOpcion(botoneraActual.id, botonComboActual.id, editOpcion.id, values)
        message.success('Opción actualizada')
      } else {
        await botoneraService.createOpcion(botoneraActual.id, botonComboActual.id, values)
        message.success('Opción creada')
      }
      setOpcionModal(false)
      loadOpciones()
    } catch { message.error('Error al guardar opción') }
  }

  const deleteOpcion = async (opcionId) => {
    try {
      await botoneraService.deleteOpcion(botoneraActual.id, botonComboActual.id, opcionId)
      message.success('Opción eliminada')
      loadOpciones()
    } catch { message.error('Error al eliminar opción') }
  }

  // ── Columnas tabla botoneras ──────────────────────────────
  const cols = [
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre' },
    { title: 'Horario', key: 'horario', render: (_, r) => `${r.hora_inicio} – ${r.hora_fin}` },
    {
      title: 'Cuadrícula', key: 'grid', width: 110,
      render: (_, r) => <Text type="secondary">{r.num_columnas || 3}×{r.num_filas || 3}</Text>,
    },
    {
      title: 'Botones', dataIndex: 'botones', key: 'botones',
      render: (b) => <Badge count={b?.length || 0} showZero color="blue" />,
    },
    {
      title: 'Estado', dataIndex: 'activa', key: 'activa',
      render: (v) => v ? <Tag color="success">Activa</Tag> : <Tag>Inactiva</Tag>,
    },
    {
      title: 'Acciones', key: 'acc',
      render: (_, r) => (
        <Space>
          <Tooltip title="Ver / editar botones">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDrawer(r)} />
          </Tooltip>
          <Tooltip title="Editar botonera">
            <Button size="small" icon={<EditOutlined />} onClick={() => openBotoneraModal(r)} />
          </Tooltip>
          <Popconfirm title="¿Eliminar esta botonera?" onConfirm={() => deleteBotonera(r.id)} okText="Sí" cancelText="No">
            <Tooltip title="Eliminar">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ── Columnas tabla botones ────────────────────────────────
  const colsBotones = [
    {
      title: 'Tipo', dataIndex: 'tipo', key: 'tipo', width: 80,
      render: (t) => t === 'combo'
        ? <Tag color="purple" icon={<UnorderedListOutlined />}>Combo</Tag>
        : <Tag color="blue">Simple</Tag>,
    },
    {
      title: 'Posición', key: 'pos', width: 90,
      render: (_, r) => r.fila && r.columna
        ? <Tag color="geekblue" style={{ fontFamily: 'monospace' }}>F{r.fila} C{r.columna}</Tag>
        : <Text type="secondary" style={{ fontSize: 12 }}>auto</Text>,
    },
    {
      title: 'Tamaño', key: 'size', width: 70,
      render: (_, r) => {
        const cs = r.col_span || 1; const rs = r.row_span || 1
        return cs === 1 && rs === 1
          ? <Text type="secondary" style={{ fontSize: 12 }}>1×1</Text>
          : <Tag color="purple" style={{ fontFamily: 'monospace' }}>{cs}×{rs}</Tag>
      },
    },
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre' },
    {
      title: 'Código / Opciones', key: 'codigo', render: (_, r) => r.tipo === 'combo'
        ? <Text type="secondary" style={{ fontSize: 12 }}>{r.opciones?.length || 0} opciones</Text>
        : <Text code>{r.producto_codigo}</Text>,
    },
    {
      title: 'Máx', dataIndex: 'max_unidades', key: 'max', width: 55,
      render: (v, r) => r.tipo === 'combo'
        ? <Text type="secondary" style={{ fontSize: 11 }}>x opción</Text>
        : v,
    },
    {
      title: 'Color', dataIndex: 'color', key: 'color', width: 50,
      render: (c) => <div style={{ width: 24, height: 24, borderRadius: 4, background: c, border: '1px solid #ddd' }} />,
    },
    {
      title: 'Visible', dataIndex: 'visible', key: 'visible', width: 70,
      render: (v) => v ? <Tag color="success">Sí</Tag> : <Tag>No</Tag>,
    },
    {
      title: 'Acciones', key: 'acc',
      render: (_, r) => (
        <Space>
          {r.tipo === 'combo' && (
            <Tooltip title="Gestionar opciones">
              <Button size="small" icon={<UnorderedListOutlined />} onClick={() => openOpcionesModal(r)} />
            </Tooltip>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => openBotonModal(r)} />
          <Popconfirm title="¿Eliminar este botón?" onConfirm={() => deleteBoton(r.id)} okText="Sí" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Botoneras</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openBotoneraModal()}>
          Nueva botonera
        </Button>
      </div>

      <Table dataSource={botoneras} columns={cols} rowKey="id" loading={loading} />

      {/* ── Modal botonera ───────────────────────────────── */}
      <Modal
        title={editTarget ? 'Editar botonera' : 'Nueva botonera'}
        open={modalOpen} onOk={saveBotoneraModal} onCancel={() => setModalOpen(false)} okText="Guardar"
      >
        <Form form={formBotonera} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="Ej: Almuerzo" />
          </Form.Item>
          <Form.Item name="hora_inicio" label="Hora inicio (HH:MM)"
            rules={[{ required: true, pattern: /^\d{2}:\d{2}$/, message: 'Formato HH:MM' }]}>
            <Input placeholder="12:00" />
          </Form.Item>
          <Form.Item name="hora_fin" label="Hora fin (HH:MM)"
            rules={[{ required: true, pattern: /^\d{2}:\d{2}$/, message: 'Formato HH:MM' }]}>
            <Input placeholder="14:30" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="num_columnas" label="Columnas" initialValue={3}
              tooltip="Columnas del panel de botones en el kiosko.">
              <InputNumber min={1} max={8} addonAfter="col" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="num_filas" label="Filas" initialValue={3}
              tooltip="Filas del panel de botones en el kiosko.">
              <InputNumber min={1} max={10} addonAfter="fil" style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="orden" label="Orden de prioridad" initialValue={0}>
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="activa" label="Activa" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Drawer botones ───────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <AppstoreOutlined />
            {`Botones — ${botoneraActual?.nombre}`}
            {botoneraActual && (
              <Text type="secondary" style={{ fontSize: 13 }}>
                ({botoneraActual.num_columnas || 3} col × {botoneraActual.num_filas || 3} fil)
              </Text>
            )}
          </Space>
        }
        open={drawerOpen} onClose={() => setDrawerOpen(false)} width={820}
        extra={
          <Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => openBotonModal()}>
            Agregar botón
          </Button>
        }
      >
        {botones.length > 0 && botoneraActual && (
          <GridPreview
            botones={botones}
            numColumnas={botoneraActual.num_columnas || 3}
            numFilas={botoneraActual.num_filas || 3}
            onEdit={openBotonModal}
          />
        )}
        <Divider style={{ margin: '12px 0' }} />
        <Table dataSource={botones} columns={colsBotones} rowKey="id" size="small" />
      </Drawer>

      {/* ── Modal botón ──────────────────────────────────── */}
      <Modal
        title={editBoton ? 'Editar botón' : 'Nuevo botón'}
        open={botonModal} onOk={saveBotonModal} onCancel={() => setBotonModal(false)} okText="Guardar"
        width={520}
      >
        <Form form={formBoton} layout="vertical" style={{ marginTop: 16 }}>

          {/* Tipo de botón */}
          <Form.Item name="tipo" label="Tipo de botón" initialValue="simple">
            <Radio.Group onChange={e => setTipoBoton(e.target.value)} buttonStyle="solid">
              <Radio.Button value="simple">🔲 Simple</Radio.Button>
              <Radio.Button value="combo">☰ Combo (elige una opción)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="nombre" label="Título del botón" rules={[{ required: true }]}>
            <Input placeholder={tipoBoton === 'combo' ? 'Ej: Almuerzo' : 'Ej: Menú del día'} />
          </Form.Item>

          {/* Solo para simple */}
          {tipoBoton === 'simple' && (
            <Form.Item name="producto_codigo" label="Código de producto (SUMMA)" rules={[{ required: true }]}>
              <Input placeholder="Ej: MENU01" />
            </Form.Item>
          )}
          {tipoBoton === 'combo' && (
            <Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ℹ️ Los productos se definen en las <strong>opciones del combo</strong> (se configuran después de guardar el botón).
              </Text>
            </Form.Item>
          )}

          {/* Para combos el máximo se define en cada opción, no en el botón */}
          {tipoBoton !== 'combo' && (
            <Form.Item name="max_unidades" label="Máximo de unidades" initialValue={1}>
              <InputNumber min={1} max={99} />
            </Form.Item>
          )}

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>
            Posición en la cuadrícula <Text type="secondary">(vacío = automático)</Text>
          </Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="fila" label={`Fila (1–${botoneraActual?.num_filas || '?'})`}>
              <InputNumber min={1} max={botoneraActual?.num_filas || 99} placeholder="Auto" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="columna" label={`Columna (1–${botoneraActual?.num_columnas || '?'})`}>
              <InputNumber min={1} max={botoneraActual?.num_columnas || 99} placeholder="Auto" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>
            Tamaño <Text type="secondary">(celdas que ocupa)</Text>
          </Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="col_span" label="Ancho (columnas)" initialValue={1}>
              <InputNumber min={1} max={botoneraActual?.num_columnas || 99} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="row_span" label="Alto (filas)" initialValue={1}>
              <InputNumber min={1} max={botoneraActual?.num_filas || 99} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item name="color" label="Color del botón" initialValue="#1677ff">
            <ColorPicker format="hex" showText />
          </Form.Item>
          <Form.Item name="orden" label="Orden (auto-placement)" initialValue={0}>
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="visible" label="Visible" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal opciones de combo ───────────────────────── */}
      <Modal
        title={
          <Space>
            <UnorderedListOutlined />
            Opciones del combo: <strong>{botonComboActual?.nombre}</strong>
          </Space>
        }
        open={opcionesModal}
        onCancel={() => setOpcionesModal(false)}
        footer={null}
        width={520}
      >
        <Button
          type="dashed" icon={<PlusOutlined />} block
          style={{ marginBottom: 12 }}
          onClick={() => openOpcionModal()}
        >
          Agregar opción
        </Button>

        {opciones.length === 0
          ? <Empty description="Sin opciones aún — agregá al menos una" />
          : (
            <List
              dataSource={[...opciones].sort((a, b) => a.orden - b.orden)}
              renderItem={(op) => (
                <List.Item
                  actions={[
                    <Button key="e" size="small" icon={<EditOutlined />} onClick={() => openOpcionModal(op)} />,
                    <Popconfirm key="d" title="¿Eliminar esta opción?" onConfirm={() => deleteOpcion(op.id)} okText="Sí" cancelText="No">
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={op.nombre}
                    description={
                      <Space size={8}>
                        <Text code>{op.producto_codigo}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>máx {op.max_unidades ?? 1}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )
        }
      </Modal>

      {/* ── Modal crear/editar opción ─────────────────────── */}
      <Modal
        title={editOpcion ? 'Editar opción' : 'Nueva opción'}
        open={opcionModal} onOk={saveOpcionModal} onCancel={() => setOpcionModal(false)} okText="Guardar"
      >
        <Form form={formOpcion} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="nombre" label="Nombre de la opción" rules={[{ required: true }]}>
            <Input placeholder="Ej: Milanesa con papas" />
          </Form.Item>
          <Form.Item name="producto_codigo" label="Código de producto (SUMMA)" rules={[{ required: true }]}>
            <Input placeholder="Ej: MILANESA01" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="max_unidades" label="Máximo de unidades" initialValue={1}
              tooltip="Cantidad máxima que puede pedir el empleado de esta opción.">
              <InputNumber min={1} max={99} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="orden" label="Orden de aparición" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GridPreview
// ─────────────────────────────────────────────────────────────────────────────
function GridPreview({ botones, numColumnas, numFilas, onEdit }) {
  const cols  = Math.max(1, numColumnas)
  const filas = Math.max(1, numFilas)

  const botsConPos = botones.filter(b => b.fila && b.columna)
  const botsSinPos = [...botones.filter(b => !b.fila || !b.columna)].sort((a, b) => a.orden - b.orden)

  const ocupadas = new Set()
  const marcar = (fi, ci, cs, rs) => {
    for (let dr = 0; dr < rs; dr++)
      for (let dc = 0; dc < cs; dc++)
        ocupadas.add(`${fi + dr}-${ci + dc}`)
  }
  botsConPos.forEach(b => marcar(b.fila, b.columna, b.col_span || 1, b.row_span || 1))

  const autoPlaced = []
  let af = 1, ac = 1
  for (const b of botsSinPos) {
    const cs = b.col_span || 1; const rs = b.row_span || 1
    let found = false
    while (!found) {
      if (ac + cs - 1 <= cols) {
        let libre = true
        for (let dr = 0; dr < rs && libre; dr++)
          for (let dc = 0; dc < cs && libre; dc++)
            if (ocupadas.has(`${af + dr}-${ac + dc}`)) libre = false
        if (libre) {
          autoPlaced.push({ ...b, _f: af, _c: ac })
          marcar(af, ac, cs, rs)
          found = true
        }
      }
      if (!found) { ac++; if (ac > cols) { ac = 1; af++ } }
    }
    ac += cs; if (ac > cols) { ac = 1; af++ }
  }

  const maxFilaFija = botsConPos.reduce((m, b) => Math.max(m, (b.fila || 0) + (b.row_span || 1) - 1), 0)
  const maxFilaAuto = autoPlaced.reduce((m, b) => Math.max(m, (b._f || 0) + (b.row_span || 1) - 1), 0)
  const totalFilas  = Math.max(filas, maxFilaFija, maxFilaAuto, 1)

  const tapadas = new Set()
  const tapar = (fi, ci, cs, rs) => {
    for (let dr = 0; dr < rs; dr++)
      for (let dc = 0; dc < cs; dc++)
        tapadas.add(`${fi + dr}-${ci + dc}`)
  }
  botsConPos.forEach(b => tapar(b.fila, b.columna, b.col_span || 1, b.row_span || 1))
  autoPlaced.forEach(b => tapar(b._f, b._c, b.col_span || 1, b.row_span || 1))

  const celdasVacias = []
  for (let fi = 1; fi <= totalFilas; fi++)
    for (let ci = 1; ci <= cols; ci++)
      if (!tapadas.has(`${fi}-${ci}`)) celdasVacias.push({ fi, ci })

  const base = {
    minHeight: 54, borderRadius: 6,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, overflow: 'hidden', transition: 'transform .12s',
  }
  const grs = (fi, rs) => rs > 1 ? `${fi} / span ${rs}` : `${fi}`
  const gcs = (ci, cs) => cs > 1 ? `${ci} / span ${cs}` : `${ci}`

  const renderBoton = (b, fi, ci, esAuto) => {
    const cs = b.col_span || 1; const rs = b.row_span || 1
    const esCombo = b.tipo === 'combo'
    const label = esAuto ? 'auto' : `F${fi} C${ci}`
    return (
      <div
        key={`${esAuto ? 'a' : 'f'}-${b.id}`}
        onClick={() => onEdit(b)}
        title={`${b.nombre}${esCombo ? ` (combo, ${b.opciones?.length || 0} op.)` : ''} — ${label}${cs > 1 || rs > 1 ? ` · ${cs}×${rs}` : ''}`}
        style={{
          ...base,
          gridRow: grs(fi, rs), gridColumn: gcs(ci, cs),
          background: b.visible ? b.color : '#bbb',
          color: '#fff', fontWeight: 700, cursor: 'pointer',
          opacity: b.visible ? (esAuto ? 0.85 : 1) : 0.45,
          padding: '4px', gap: 2,
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
          border: esAuto ? '2px dashed rgba(255,255,255,0.65)' : '2px solid rgba(255,255,255,0.3)',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
        onMouseLeave={e  => e.currentTarget.style.transform = 'scale(1)'}
      >
        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%', textAlign:'center', padding:'0 2px' }}>
          {esCombo ? '☰ ' : ''}{b.nombre}
        </span>
        <span style={{ fontSize: 9, opacity: 0.8, fontWeight: 400 }}>
          {label}{cs > 1 || rs > 1 ? ` · ${cs}×${rs}` : ''}
          {esCombo && ` · ${b.opciones?.length || 0} op.`}
        </span>
      </div>
    )
  }

  return (
    <div>
      <Text strong style={{ fontSize: 13 }}><AppstoreOutlined /> Vista previa</Text>
      <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
        {cols}×{totalFilas}{totalFilas > filas ? <span style={{ color: '#fa8c16' }}> (ampliada)</span> : ''}
        {' · '}clic para editar
      </Text>

      <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols}, 1fr)`, gap:5, marginTop:8, paddingBottom:2 }}>
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} style={{ textAlign:'center', fontSize:11, color:'#aaa', fontWeight:700 }}>col {i+1}</div>
        ))}
      </div>

      <div style={{
        display:'grid',
        gridTemplateColumns:`repeat(${cols}, 1fr)`,
        gridTemplateRows:`repeat(${totalFilas}, minmax(54px,auto))`,
        gap:5, background:'#ebebeb', borderRadius:8, padding:8, border:'1px solid #d9d9d9',
      }}>
        {celdasVacias.map(({ fi, ci }) => (
          <div key={`v-${fi}-${ci}`} style={{
            ...base, gridRow:fi, gridColumn:ci,
            border:'2px dashed #d0d0d0', background:'#fafafa', color:'#c0c0c0', gap:1,
          }}>
            <span style={{ fontSize:10, fontWeight:600 }}>F{fi} C{ci}</span>
            <span style={{ fontSize:16, lineHeight:1, color:'#ddd' }}>+</span>
          </div>
        ))}
        {botsConPos.map(b => renderBoton(b, b.fila, b.columna, false))}
        {autoPlaced.map(b => renderBoton(b, b._f, b._c, true))}
      </div>

      <div style={{ marginTop:6, display:'flex', gap:16, flexWrap:'wrap' }}>
        {[
          { bg:'#1677ff', border:'none',             label:'Posición fija' },
          { bg:'#1677ff', border:'2px dashed white', label:'Auto', opacity:0.6 },
          { bg:'#fafafa', border:'2px dashed #ccc',  label:'Libre', color:'#999' },
        ].map(({ bg, border, label, opacity, color }) => (
          <Text key={label} type="secondary" style={{ fontSize:11, display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ display:'inline-block', width:12, height:12, borderRadius:2, background:bg, border, opacity, flexShrink:0 }}/>
            <span style={{ color }}>{label}</span>
          </Text>
        ))}
        <Text type="secondary" style={{ fontSize:11 }}>· ☰ = botón combo</Text>
      </div>
    </div>
  )
}
