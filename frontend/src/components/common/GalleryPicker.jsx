/**
 * GalleryPicker.jsx
 * Campo reutilizable para elegir una imagen de la galería local
 * (backend/data/uploads/) — usado para el logo de la empresa (Configuración)
 * y para el ícono de un botón / opción de combo (Botoneras).
 *
 * `value` es el nombre de archivo guardado (no la URL completa) — así es
 * como lo espera el backend (SystemSetting.logo_url, Boton.icono_url,
 * BotonOpcion.icono_url). El componente arma la URL de vista previa solo.
 *
 * Props:
 *  - value    : string | null | ''  → nombre de archivo actual
 *  - onChange : (filename: string) => void  — '' significa "sin imagen"
 *  - label    : texto del botón cuando no hay imagen elegida (opcional)
 */
import { useState, useEffect } from 'react'
import { Modal, Button, Upload, Empty, Spin, message, Tooltip, Typography } from 'antd'
import { PictureOutlined, UploadOutlined, CloseCircleFilled } from '@ant-design/icons'
import { galleryService } from '../../services/galleryService'
import { conPrefijo } from '../../utils/wafPrefix'

const { Text } = Typography

export function GalleryPicker({ value, onChange, label = 'Elegir imagen' }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [images, setImages]       = useState([])
  const [loading, setLoading]     = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setImages(await galleryService.getAll()) }
    catch { message.error('Error al cargar la galería.') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (modalOpen) load() }, [modalOpen])

  const handleUpload = async (file) => {
    setUploading(true)
    try {
      const img = await galleryService.upload(file)
      message.success('Imagen subida.')
      setImages((prev) => [img, ...prev])
      onChange(img.filename)
      setModalOpen(false)
    } catch (e) {
      message.error(e.response?.data?.detail || 'Error al subir la imagen.')
    } finally {
      setUploading(false)
    }
    return false  // evita que antd intente subirlo por su cuenta
  }

  const handlePick = (filename) => {
    onChange(filename)
    setModalOpen(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {value ? (
        <div style={{ position: 'relative', width: 56, height: 56 }}>
          <img
            src={conPrefijo(`/uploads/${value}`)}
            alt=""
            style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8, border: '1px solid #d9d9d9', background: '#fafafa' }}
          />
          <Tooltip title="Quitar imagen">
            <CloseCircleFilled
              onClick={() => onChange('')}
              style={{ position: 'absolute', top: -6, right: -6, background: '#fff', borderRadius: '50%', color: '#ff4d4f', fontSize: 16, cursor: 'pointer' }}
            />
          </Tooltip>
        </div>
      ) : (
        <div style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #d9d9d9', borderRadius: 8, color: '#bfbfbf' }}>
          <PictureOutlined style={{ fontSize: 22 }} />
        </div>
      )}
      <Button size="small" icon={<PictureOutlined />} onClick={() => setModalOpen(true)}>
        {value ? 'Cambiar' : label}
      </Button>

      <Modal
        title="Galería de imágenes"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={640}
      >
        <Upload beforeUpload={handleUpload} showUploadList={false} accept="image/*" disabled={uploading}>
          <Button icon={<UploadOutlined />} loading={uploading} style={{ marginBottom: 16 }}>
            Subir imagen nueva
          </Button>
        </Upload>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : images.length === 0 ? (
          <Empty description="Todavía no se subió ninguna imagen." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
            {images.map((img) => (
              <div
                key={img.id}
                onClick={() => handlePick(img.filename)}
                title={img.original_name}
                style={{
                  cursor: 'pointer', border: img.filename === value ? '2px solid #1677ff' : '1px solid #d9d9d9',
                  borderRadius: 8, padding: 4, textAlign: 'center', background: '#fafafa',
                }}
              >
                <img src={img.url} alt="" style={{ width: '100%', height: 64, objectFit: 'contain' }} />
                <Text ellipsis style={{ fontSize: 11, display: 'block', marginTop: 4 }}>{img.original_name}</Text>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
