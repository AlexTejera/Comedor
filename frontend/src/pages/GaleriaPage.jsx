/**
 * GaleriaPage.jsx
 * Gestión de la galería de imágenes local — subir, ver y borrar. Las mismas
 * imágenes se eligen después desde Configuración (logo) y Botoneras (íconos)
 * vía el componente GalleryPicker.
 */
import { useState, useEffect } from 'react'
import { Button, Upload, Empty, Spin, message, Popconfirm, Typography, Card, Tag } from 'antd'
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons'
import { galleryService } from '../services/galleryService'
import { conPrefijo } from '../utils/wafPrefix'

const { Title, Text } = Typography

export default function GaleriaPage() {
  const [images, setImages]     = useState([])
  const [loading, setLoading]   = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setImages(await galleryService.getAll()) }
    catch { message.error('Error al cargar la galería.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleUpload = async (file) => {
    setUploading(true)
    try {
      await galleryService.upload(file)
      message.success('Imagen subida.')
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Error al subir la imagen.')
    } finally {
      setUploading(false)
    }
    return false
  }

  const handleDelete = async (id) => {
    try {
      await galleryService.delete(id)
      message.success('Imagen eliminada.')
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Error al eliminar la imagen.')
    }
  }

  const formatSize = (bytes) => bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Galería de imágenes</Title>
        <Upload beforeUpload={handleUpload} showUploadList={false} accept="image/*" disabled={uploading}>
          <Button type="primary" icon={<UploadOutlined />} loading={uploading}>Subir imagen</Button>
        </Upload>
      </div>

      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Estas imágenes se pueden usar como logo de la empresa (Configuración) o como ícono de botones
        y opciones de combo (Botoneras). PNG, JPG, WEBP, GIF o SVG — máximo 5 MB.
      </Text>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : images.length === 0 ? (
        <Empty description="Todavía no se subió ninguna imagen." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {images.map((img) => (
            <Card
              key={img.id}
              size="small"
              cover={<div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', padding: 8 }}>
                <img src={conPrefijo(img.url)} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>}
              actions={[
                <Popconfirm
                  key="del"
                  title="¿Eliminar esta imagen?"
                  description="Se rechaza si está en uso como logo o ícono de algún botón/opción."
                  onConfirm={() => handleDelete(img.id)}
                  okText="Eliminar" okButtonProps={{ danger: true }} cancelText="Cancelar"
                >
                  <DeleteOutlined style={{ color: '#ff4d4f' }} />
                </Popconfirm>,
              ]}
            >
              <Card.Meta
                title={<Text ellipsis style={{ fontSize: 12 }}>{img.original_name}</Text>}
                description={<Tag style={{ fontSize: 10 }}>{formatSize(img.size_bytes)}</Tag>}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
