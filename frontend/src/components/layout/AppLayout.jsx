import { useState } from 'react'
import { Layout, Menu, Button, Typography, theme } from 'antd'
import {
  DashboardOutlined,
  AppstoreOutlined,
  HistoryOutlined,
  SettingOutlined,
  UserOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CoffeeOutlined,
  ShoppingOutlined,
  ApartmentOutlined,
  PictureOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const { Sider, Content, Header } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/admin', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/admin/botoneras', icon: <AppstoreOutlined />, label: 'Botoneras' },
  { key: '/admin/articulos', icon: <ShoppingOutlined />, label: 'Artículos' },
  { key: '/admin/categorias', icon: <ApartmentOutlined />, label: 'Categorías' },
  { key: '/admin/galeria', icon: <PictureOutlined />, label: 'Galería' },
  { key: '/admin/logs', icon: <HistoryOutlined />, label: 'Historial' },
  { key: '/admin/settings', icon: <SettingOutlined />, label: 'Configuración' },
  { key: '/admin/users', icon: <UserOutlined />, label: 'Usuarios' },
  { key: '/admin/backup', icon: <DatabaseOutlined />, label: 'Backup' },
]

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useAuth()
  const { token } = theme.useToken()

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{ background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 16px',
          gap: 8,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}>
          <CoffeeOutlined style={{ fontSize: 22, color: token.colorPrimary }} />
          {!collapsed && (
            <Text strong style={{ fontSize: 14, color: token.colorPrimary }}>
              Comedor Admin
            </Text>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header style={{
          background: token.colorBgContainer,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>{user?.username}</Text>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              danger
            >
              Salir
            </Button>
          </div>
        </Header>

        <Content style={{ margin: 24, background: token.colorBgContainer, borderRadius: token.borderRadiusLG, padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
