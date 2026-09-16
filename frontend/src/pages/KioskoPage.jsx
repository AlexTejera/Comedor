/**
 * KioskoPage.jsx
 * Pantalla principal del kiosko (pantalla pública, sin autenticación admin).
 *
 * Estados principales:
 *  'login'       → ingreso del número de empleado
 *  'validating'  → consultando a SUMMA
 *  'selection'   → eligiendo productos de la botonera
 *  'no-service'  → no hay botonera activa en este horario
 *  'confirming'  → resumen del pedido antes de enviar
 *  'processing'  → enviando pedido a SUMMA
 *  'success'     → pedido OK, imprimiendo ticket
 *  'error'       → error general
 *
 * seleccion[botonId]:
 *   - botón simple : number  (cantidad, 0 = no seleccionado)
 *   - botón combo  : { opcionId, productoCodigo, opcionNombre, maxUnidades, cantidad } | null
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Spin } from 'antd'
import { kioskService } from '../services/kioskService'
import dayjs from 'dayjs'

const INACTIVITY_TIMEOUT = 60_000
const SUCCESS_TIMEOUT    = 5_000

// Traduce un anclaje de 9 posiciones (texto_posicion / controles_posicion,
// mismos valores que imagen_posicion) a coordenadas dentro de la cuadrícula
// interna 3×3 de .producto-btn (ver .producto-btn en index.css) — cada
// elemento queda pegado al borde/esquina que le corresponde, en vez de
// simplemente centrado dentro de su celda.
const ANCHOR_GRID = {
  'top left':     { gridRow: 1, gridColumn: 1, justifySelf: 'start',  alignSelf: 'start'  },
  'top':          { gridRow: 1, gridColumn: 2, justifySelf: 'center', alignSelf: 'start'  },
  'top right':    { gridRow: 1, gridColumn: 3, justifySelf: 'end',    alignSelf: 'start'  },
  'left':         { gridRow: 2, gridColumn: 1, justifySelf: 'start',  alignSelf: 'center' },
  'center':       { gridRow: 2, gridColumn: 2, justifySelf: 'center', alignSelf: 'center' },
  'right':        { gridRow: 2, gridColumn: 3, justifySelf: 'end',    alignSelf: 'center' },
  'bottom left':  { gridRow: 3, gridColumn: 1, justifySelf: 'start',  alignSelf: 'end'    },
  'bottom':       { gridRow: 3, gridColumn: 2, justifySelf: 'center', alignSelf: 'end'    },
  'bottom right': { gridRow: 3, gridColumn: 3, justifySelf: 'end',    alignSelf: 'end'    },
}
const anchorStyle = (pos) => ANCHOR_GRID[pos] || ANCHOR_GRID.center

export default function KioskoPage() {
  const [estado, setEstado]           = useState('login')
  const [numero, setNumero]           = useState('')
  const [empleado, setEmpleado]       = useState(null)
  const [botonera, setBotonera]       = useState(null)
  const [seleccion, setSeleccion]     = useState({})
  const [errorMsg, setErrorMsg]       = useState('')
  const [ahora, setAhora]             = useState(dayjs())
  const [mostrarNumpad, setMostrarNumpad] = useState(true)  // default: visible
  const [totalConsumo, setTotalConsumo]   = useState(null)  // null = no disponible aún
  const [logoUrl, setLogoUrl]             = useState(null)  // null = sin logo configurado (fallback a texto)
  const inactivityTimer               = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setAhora(dayjs()), 1000)
    return () => clearInterval(t)
  }, [])

  // Cargar configuración pública del kiosko al iniciar
  useEffect(() => {
    kioskService.getConfig()
      .then(cfg => {
        if (cfg.mostrar_numpad !== undefined) {
          setMostrarNumpad(cfg.mostrar_numpad !== 'false')
        }
        if (cfg.logo_url) setLogoUrl(cfg.logo_url)
      })
      .catch(() => { /* si falla, mantiene el default visible */ })
  }, [])

  const resetInactivity = useCallback(() => {
    clearTimeout(inactivityTimer.current)
    if (estado !== 'login') {
      inactivityTimer.current = setTimeout(() => resetKiosko(), INACTIVITY_TIMEOUT)
    }
  }, [estado])

  useEffect(() => {
    resetInactivity()
    return () => clearTimeout(inactivityTimer.current)
  }, [estado, resetInactivity])

  const resetKiosko = () => {
    setEstado('login'); setNumero(''); setEmpleado(null)
    setBotonera(null); setSeleccion({}); setErrorMsg(''); setTotalConsumo(null)
    clearTimeout(inactivityTimer.current)
  }

  // ── Validar empleado ──────────────────────────────────────────────────────
  const handleValidar = async () => {
    if (!numero) return
    setEstado('validating')
    try {
      const res = await kioskService.validarEmpleado(parseInt(numero, 10))
      if (res.Estado !== 'OK') {
        setErrorMsg(res.Mensaje || 'Error al validar empleado.')
        setEstado('error'); setTimeout(resetKiosko, 6000); return
      }
      setEmpleado({ codigo: parseInt(numero, 10), nombre: res.NombreEmpleado || '' })
      if (!res.botonera?.botones?.length) {
        setEstado('no-service'); setTimeout(resetKiosko, 8000); return
      }
      setBotonera(res.botonera); setSeleccion({}); setEstado('selection')
    } catch {
      setErrorMsg('Error de comunicación con el servidor.')
      setEstado('error'); setTimeout(resetKiosko, 6000)
    }
  }

  // ── Handlers de selección ─────────────────────────────────────────────────

  const cambiarCantidad = (boton, delta) => {
    resetInactivity()
    setSeleccion(prev => {
      const actual = (typeof prev[boton.id] === 'number' ? prev[boton.id] : 0)
      const nuevo  = Math.max(0, Math.min(boton.max_unidades, actual + delta))
      if (nuevo === 0) { const { [boton.id]: _, ...rest } = prev; return rest }
      return { ...prev, [boton.id]: nuevo }
    })
  }

  /** Elige una opción del combo (desde el overlay). Reemplaza la anterior. */
  const elegirOpcionCombo = (boton, opcion) => {
    resetInactivity()
    setSeleccion(prev => {
      if (prev[boton.id]?.opcionId === opcion.id) {
        const { [boton.id]: _, ...rest } = prev; return rest
      }
      return {
        ...prev,
        [boton.id]: {
          opcionId:       opcion.id,
          productoCodigo: opcion.producto_codigo,
          opcionNombre:   opcion.nombre,
          maxUnidades:    opcion.max_unidades || 1,
          cantidad:       1,
        },
      }
    })
  }

  /** Cambia la cantidad de la opción ya elegida en un combo. */
  const cambiarCantidadCombo = (boton, delta) => {
    resetInactivity()
    setSeleccion(prev => {
      const actual = prev[boton.id]
      if (!actual) return prev
      const nuevo = Math.max(1, Math.min(actual.maxUnidades, actual.cantidad + delta))
      return { ...prev, [boton.id]: { ...actual, cantidad: nuevo } }
    })
  }

  // ── Items seleccionados ───────────────────────────────────────────────────
  const itemsSeleccionados = (botonera?.botones || [])
    .filter(b => {
      const sel = seleccion[b.id]
      if (!sel) return false
      return b.tipo === 'combo' ? sel.cantidad > 0 : sel > 0
    })
    .map(b => {
      const sel = seleccion[b.id]
      if (b.tipo === 'combo') return {
        articulo: sel.productoCodigo,
        nombre:   `${b.nombre} — ${sel.opcionNombre}`,
        cantidad: sel.cantidad,
      }
      return { articulo: b.producto_codigo, nombre: b.nombre, cantidad: sel }
    })

  const totalItems = itemsSeleccionados.reduce((s, i) => s + i.cantidad, 0)

  // ── Confirmar pedido ──────────────────────────────────────────────────────
  const handleConfirmar = async () => {
    if (!itemsSeleccionados.length) return
    setEstado('processing')
    try {
      const res = await kioskService.confirmarPedido(empleado.codigo, empleado.nombre, itemsSeleccionados)
      if (res.Estado !== 'OK') {
        setErrorMsg(res.Mensaje || 'El pedido fue rechazado por el servidor.')
        setEstado('error')
        setTimeout(() => { setErrorMsg(''); setEstado('selection') }, 6000)
        return
      }
      setEstado('success')
      // Obtener total en $ antes de imprimir
      kioskService.getTotalConsumo(empleado.codigo)
        .then(r => { if (r.Estado === 'OK') setTotalConsumo(r.Total) })
        .catch(() => {})  // si falla, el ticket muestra $ ---
        .finally(() => setTimeout(() => window.print(), 400))
      setTimeout(resetKiosko, SUCCESS_TIMEOUT)
    } catch {
      setErrorMsg('Error de comunicación al confirmar el pedido.')
      setEstado('error')
      setTimeout(() => { setErrorMsg(''); setEstado('selection') }, 6000)
    }
  }

  return (
    <div className="kiosko-root" onClick={resetInactivity} onKeyDown={resetInactivity}>
      <header className="kiosko-header">
        {logoUrl ? (
          <img className="kiosko-logo-img" src={logoUrl} alt="Logo de la empresa" />
        ) : (
          <span className="kiosko-logo">🍽️ Comedor — Aluminios del Uruguay</span>
        )}
        <span className="kiosko-time">{ahora.format('HH:mm:ss')}</span>
      </header>

      <main className="kiosko-body">
        {estado === 'login' && (
          <LoginView numero={numero} setNumero={setNumero} onConfirm={handleValidar} mostrarNumpad={mostrarNumpad} />
        )}
        {estado === 'validating' && (
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16, color: '#fff', fontSize: 18 }}>Verificando empleado…</p>
          </div>
        )}
        {estado === 'no-service' && (
          <MessageView icon="⏰" title="Sin servicio en este horario"
            subtitle="No hay botonera activa para el horario actual." color="#faad14" />
        )}
        {estado === 'selection' && botonera && (
          <SelectionView
            empleado={empleado} botonera={botonera} seleccion={seleccion} totalItems={totalItems}
            onCambiar={cambiarCantidad} onElegirOpcion={elegirOpcionCombo}
            onCambiarCantidadCombo={cambiarCantidadCombo}
            onConfirmar={() => setEstado('confirming')} onCancelar={resetKiosko}
          />
        )}
        {estado === 'confirming' && (
          <ConfirmView empleado={empleado} items={itemsSeleccionados}
            onConfirmar={handleConfirmar} onVolver={() => setEstado('selection')} />
        )}
        {estado === 'processing' && (
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16, color: '#fff', fontSize: 18 }}>Registrando pedido…</p>
          </div>
        )}
        {estado === 'success' && (
          <MessageView icon="✅" title="¡Pedido registrado!"
            subtitle="Se está imprimiendo tu ticket. Retirá tu orden." color="#52c41a" />
        )}
        {estado === 'error' && (
          <MessageView icon="❌" title="Error" subtitle={errorMsg} color="#ff4d4f" />
        )}
      </main>

      {estado === 'success' && empleado && (
        <TicketPrint empleado={empleado} items={itemsSeleccionados} fecha={ahora} total={totalConsumo} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginView
// ─────────────────────────────────────────────────────────────────────────────
function LoginView({ numero, setNumero, onConfirm, mostrarNumpad }) {
  // Soporte de teclado físico (activo siempre, útil especialmente cuando el numpad está oculto)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        setNumero(prev => prev.length < 10 ? prev + e.key : prev)
      } else if (e.key === 'Backspace') {
        setNumero(prev => prev.slice(0, -1))
      } else if (e.key === 'Enter') {
        if (numero) onConfirm()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [numero, setNumero, onConfirm])

  const handleKey = (k) => {
    if (k === 'back')       setNumero(prev => prev.slice(0, -1))
    else if (k === 'ok')    onConfirm()
    else if (numero.length < 10) setNumero(prev => prev + k)
  }
  const digits = ['1','2','3','4','5','6','7','8','9','','0','']

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:24, width:'100%', maxWidth:380 }}>
      <div style={{ textAlign:'center', marginBottom:8 }}>
        <p style={{ color:'rgba(255,255,255,0.7)', fontSize:20, marginBottom:4 }}>Bienvenido/a</p>
        <p style={{ color:'rgba(255,255,255,0.9)', fontSize:16 }}>Ingresá tu número de empleado</p>
      </div>

      <div className={`numpad-display ${!numero ? 'placeholder' : ''}`}>
        {numero || 'Nº de empleado'}
      </div>

      {mostrarNumpad ? (
        /* Modo numpad: teclado virtual en pantalla */
        <div className="numpad-grid">
          {digits.map((d, i) => {
            if (d === '') return <div key={i} />
            return <button key={i} className="numpad-btn digit" onClick={() => handleKey(d)}>{d}</button>
          })}
          <button className="numpad-btn back" onClick={() => handleKey('back')}>⌫</button>
          <button className="numpad-btn confirm" onClick={() => handleKey('ok')} disabled={!numero}>Entrar</button>
        </div>
      ) : (
        /* Modo teclado físico: solo botón Entrar + hint */
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, width:'100%', maxWidth:280 }}>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14, textAlign:'center', margin:0 }}>
            Usá el teclado y presioná <kbd style={{
              background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)',
              borderRadius:4, padding:'1px 7px', fontFamily:'monospace', fontSize:13
            }}>Enter</kbd> para ingresar
          </p>
          <button
            className="numpad-btn confirm"
            onClick={onConfirm}
            disabled={!numero}
            style={{ width:'100%', height:56, fontSize:18 }}
          >
            ↵ Entrar
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SelectionView
// ─────────────────────────────────────────────────────────────────────────────
function SelectionView({ empleado, botonera, seleccion, totalItems, onCambiar, onElegirOpcion, onCambiarCantidadCombo, onConfirmar, onCancelar }) {
  const [comboAbierto, setComboAbierto] = useState(null)
  const botonCombo = botonera.botones.find(b => b.id === comboAbierto)

  return (
    <div style={{ width:'100%', maxWidth:960 }}>
      <div style={{ marginBottom:20, textAlign:'center' }}>
        <p style={{ color:'rgba(255,255,255,0.7)', fontSize:16 }}>
          Hola, <strong style={{ color:'#fff' }}>{empleado.nombre || `Empleado ${empleado.codigo}`}</strong>
        </p>
        <p style={{ color:'rgba(255,255,255,0.9)', fontSize:20, fontWeight:700 }}>{botonera.nombre}</p>
      </div>

      <div
        className="botonera-grid"
        style={{
          gridTemplateColumns: `repeat(${botonera.num_columnas || 3}, 1fr)`,
          gridTemplateRows:    `repeat(${botonera.num_filas    || 3}, 1fr)`,
        }}
      >
        {botonera.botones.map(b => {
          const cs = b.col_span || 1; const rs = b.row_span || 1
          // Si el botón tiene ícono, se usa como FONDO del botón (foto de
          // producto), con un velo oscuro encima para que el texto blanco
          // siga siendo legible sin importar el contenido de la imagen.
          // Sin ícono, se usa el color plano configurado (comportamiento previo).
          const fondoStyle = b.icono_url
            ? {
                backgroundColor: b.color,
                backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${b.icono_url})`,
                backgroundSize: b.imagen_ajuste || 'cover',
                backgroundPosition: b.imagen_posicion || 'center',
                backgroundRepeat: 'no-repeat',
              }
            : { background: b.color }
          const tituloStyle = { ...anchorStyle(b.texto_posicion), fontSize: `${b.texto_tamano || 18}px` }
          const gridStyle = {}
          if (b.fila)        gridStyle.gridRow    = rs > 1 ? `${b.fila} / span ${rs}` : b.fila
          else if (rs > 1)   gridStyle.gridRow    = `span ${rs}`
          if (b.columna)     gridStyle.gridColumn = cs > 1 ? `${b.columna} / span ${cs}` : b.columna
          else if (cs > 1)   gridStyle.gridColumn = `span ${cs}`

          if (b.tipo === 'combo') {
            const sel = seleccion[b.id] || null
            return (
              <div
                key={b.id}
                className={`producto-btn ${sel ? 'selected' : ''}`}
                style={{ ...fondoStyle, ...gridStyle, cursor:'pointer', fontFamily: b.texto_fuente || 'inherit' }}
                onClick={() => setComboAbierto(b.id)}
              >
                <div style={{ ...anchorStyle(b.texto_posicion), display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                  <span className="nombre" style={{ fontSize: tituloStyle.fontSize }}>☰ {b.nombre}</span>
                  {sel ? (
                    <span className="combo-resumen">{sel.opcionNombre} × {sel.cantidad}</span>
                  ) : (
                    <span className="combo-hint">Toca para elegir ▾</span>
                  )}
                </div>
              </div>
            )
          }

          // Botón simple
          const cant = (typeof seleccion[b.id] === 'number' ? seleccion[b.id] : 0)
          return (
            <div
              key={b.id}
              className={`producto-btn ${cant > 0 ? 'selected' : ''}`}
              style={{ ...fondoStyle, ...gridStyle, fontFamily: b.texto_fuente || 'inherit' }}
            >
              <span className="nombre" style={tituloStyle}>{b.nombre}</span>
              {cant > 0 && <span className="cantidad-badge">{cant}</span>}
              <div className="cantidad-controls" style={anchorStyle(b.controles_posicion)}>
                <button onClick={() => onCambiar(b, -1)} disabled={cant === 0}>−</button>
                <span className="cantidad-num" style={{ fontSize: `${b.texto_tamano || 18}px` }}>{cant}</span>
                <button onClick={() => onCambiar(b, 1)} disabled={cant >= b.max_unidades}>+</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Overlay del combo abierto */}
      {botonCombo && (
        <ComboOverlay
          boton={botonCombo}
          seleccion={seleccion[botonCombo.id] || null}
          onElegir={(op) => onElegirOpcion(botonCombo, op)}
          onCantidad={(d) => onCambiarCantidadCombo(botonCombo, d)}
          onCerrar={() => setComboAbierto(null)}
        />
      )}

      <div className="kiosko-actions" style={{ justifyContent:'center' }}>
        <button className="numpad-btn back" style={{ width:160, height:56, fontSize:16, borderRadius:12 }} onClick={onCancelar}>
          Cancelar
        </button>
        <button className="numpad-btn confirm" style={{ width:240, height:56, fontSize:16, borderRadius:12 }}
          onClick={onConfirmar} disabled={totalItems === 0}>
          Confirmar pedido ({totalItems})
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ComboOverlay — panel desplegable sobre la grilla
// ─────────────────────────────────────────────────────────────────────────────
function ComboOverlay({ boton, seleccion, onElegir, onCantidad, onCerrar }) {
  return (
    <div className="combo-overlay" onClick={onCerrar}>
      <div className="combo-panel" onClick={e => e.stopPropagation()}>
        {/* Título */}
        <div className="combo-panel-header">
          <span className="combo-panel-titulo">☰ {boton.nombre}</span>
          <button className="combo-panel-cerrar" onClick={onCerrar}>✕</button>
        </div>

        <p className="combo-panel-hint">Elegí una opción</p>

        {/* Lista de opciones */}
        <div className="combo-panel-opciones">
          {boton.opciones?.length
            ? boton.opciones.map(op => {
                const elegida = seleccion?.opcionId === op.id
                return (
                  <div key={op.id} className={`combo-panel-opcion ${elegida ? 'elegida' : ''}`}>
                    <button className="combo-panel-opcion-btn" onClick={() => onElegir(op)}>
                      <span className="combo-radio-icon">{elegida ? '●' : '○'}</span>
                      {op.icono_url && <img className="combo-opcion-icono" src={op.icono_url} alt="" />}
                      <span className="combo-opcion-nombre">{op.nombre}</span>
                      {op.max_unidades > 1 && (
                        <span className="combo-opcion-max">máx {op.max_unidades}</span>
                      )}
                    </button>

                    {/* Stepper de cantidad — solo si está elegida y el máximo es > 1 */}
                    {elegida && op.max_unidades > 1 && (
                      <div className="cantidad-controls combo-panel-cantidad">
                        <button onClick={() => onCantidad(-1)} disabled={seleccion.cantidad <= 1}>−</button>
                        <span className="cantidad-num">{seleccion.cantidad}</span>
                        <button onClick={() => onCantidad(1)} disabled={seleccion.cantidad >= op.max_unidades}>+</button>
                      </div>
                    )}
                  </div>
                )
              })
            : <p style={{ textAlign:'center', opacity:0.6, padding:'16px 0' }}>Sin opciones configuradas</p>
          }
        </div>

        {/* Botón aceptar */}
        <button
          className="numpad-btn confirm"
          style={{ width:'100%', height:56, fontSize:18, borderRadius:12, marginTop:8 }}
          onClick={onCerrar}
          disabled={!seleccion}
        >
          {seleccion
            ? `✔ Aceptar — ${seleccion.opcionNombre}${seleccion.cantidad > 1 ? ` × ${seleccion.cantidad}` : ''}`
            : 'Elegí una opción'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmView
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmView({ empleado, items, onConfirmar, onVolver }) {
  return (
    <div style={{ maxWidth:500, width:'100%', textAlign:'center' }}>
      <p style={{ fontSize:24, fontWeight:700, marginBottom:8 }}>Confirmá tu pedido</p>
      <p style={{ color:'rgba(255,255,255,0.7)', marginBottom:24 }}>
        {empleado.nombre || `Empleado ${empleado.codigo}`}
      </p>
      <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:12, padding:20, marginBottom:24, textAlign:'left' }}>
        {items.map((item, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:18,
            borderBottom: i < items.length-1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
            <span>{item.nombre}</span>
            <strong>x{item.cantidad}</strong>
          </div>
        ))}
      </div>
      <div className="kiosko-actions" style={{ justifyContent:'center' }}>
        <button className="numpad-btn back" style={{ width:160, height:56, fontSize:16, borderRadius:12 }} onClick={onVolver}>
          ← Volver
        </button>
        <button className="numpad-btn confirm" style={{ width:240, height:56, fontSize:16, borderRadius:12 }} onClick={onConfirmar}>
          ✔ Confirmar e imprimir
        </button>
      </div>
    </div>
  )
}

function MessageView({ icon, title, subtitle, color }) {
  return (
    <div style={{ textAlign:'center', maxWidth:480 }}>
      <div style={{ fontSize:72, marginBottom:16 }}>{icon}</div>
      <p style={{ fontSize:28, fontWeight:700, color, marginBottom:12 }}>{title}</p>
      <p style={{ fontSize:18, color:'rgba(255,255,255,0.8)' }}>{subtitle}</p>
    </div>
  )
}

function TicketPrint({ empleado, items, fecha, total }) {

  return (
    <div className="ticket-print">

      {/* ── Encabezado ── */}
      <div className="ticket-titulo">ALUMINIOS DEL URUGUAY</div>
      <div className="ticket-subtitulo">Comedor</div>

      <div className="separador" />

      {/* ── Datos del empleado ── */}
      <div className="ticket-empleado-nombre">{empleado.nombre || `Empleado ${empleado.codigo}`}</div>
      <div className="ticket-empleado-meta">
        <span>Nº {empleado.codigo}</span>
        <span>{fecha.format('DD/MM/YYYY  HH:mm')}</span>
      </div>

      <div className="separador" />

      {/* ── Detalle de consumo ── */}
      <div className="ticket-items-header">
        <span>Artículo</span><span>Cant.</span>
      </div>
      {items.map((item, i) => (
        <div key={i} className="item-row">
          <span>{item.nombre}</span>
          <span>x{item.cantidad}</span>
        </div>
      ))}

      <div className="separador" />

      {/* ── Total en $ ── */}
      <div className="ticket-total-row">
        <span>Total consumido</span>
        <span className="ticket-total-valor">
          {total !== null ? `$ ${Number(total).toLocaleString('es-UY', { minimumFractionDigits: 2 })}` : '$ ---'}
        </span>
      </div>

      <div className="separador" />

      {/* ── Pie ── */}
      <div className="pie">Presentá este ticket para retirar tu orden</div>
    </div>
  )
}
