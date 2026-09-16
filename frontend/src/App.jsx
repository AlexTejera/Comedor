import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'

// Páginas
import KioskoPage    from './pages/KioskoPage'
import AdminLoginPage from './pages/AdminLoginPage'
import DashboardPage from './pages/DashboardPage'
import BotonerasPage from './pages/BotonerasPage'
import ArticulosPage from './pages/ArticulosPage'
import CategoriasPage from './pages/CategoriasPage'
import LogsPage      from './pages/LogsPage'
import SettingsPage  from './pages/SettingsPage'
import UsersPage     from './pages/UsersPage'
import BackupPage    from './pages/BackupPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ── Kiosko público ─────────────────────────────── */}
        <Route path="/" element={<KioskoPage />} />

        {/* ── Panel de administración ─────────────────────── */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="botoneras" element={<BotonerasPage />} />
          <Route path="articulos" element={<ArticulosPage />} />
          <Route path="categorias" element={<CategoriasPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="backup" element={<BackupPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
