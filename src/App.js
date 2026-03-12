import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import LoadingScreen from './components/LoadingScreen'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import BorrowersPage from './pages/BorrowersPage'
import LoansPage from './pages/LoansPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import AuditPage from './pages/AuditPage'
import ForecastPage from './pages/ForecastPage'
import CollectionPage from './pages/CollectionPage'
import ApplicationsPage from './pages/ApplicationsPage'
import PublicApplyPage from './pages/PublicApplyPage'
import BorrowerPortalPage from './pages/BorrowerPortalPage'
import FAQPage from './pages/FAQPage'
import NotificationBell from './components/NotificationBell'
import './index.css'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return user ? children : <Navigate to="/admin" replace />
}

function AppLayout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', minHeight: '100vh' }}>
        {children}
      </main>
      <NotificationBell />
    </div>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      {/* ── Public routes ── */}
      <Route path="/"              element={<PublicApplyPage />} />
      <Route path="/apply"         element={<PublicApplyPage />} />
      <Route path="/portal"        element={<BorrowerPortalPage />} />
      <Route path="/faq"           element={<FAQPage />} />

      {/* ── Admin auth ── */}
      <Route path="/admin"         element={user ? <Navigate to="/admin/dashboard" replace /> : <LoginPage />} />
      <Route path="/login"         element={<Navigate to="/admin" replace />} />

      {/* ── Admin protected routes ── */}
      <Route path="/admin/dashboard"    element={<ProtectedRoute><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/borrowers"    element={<ProtectedRoute><AppLayout><BorrowersPage /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/loans"        element={<ProtectedRoute><AppLayout><LoansPage /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/collection"   element={<ProtectedRoute><AppLayout><CollectionPage /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/forecast"     element={<ProtectedRoute><AppLayout><ForecastPage /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/audit"        element={<ProtectedRoute><AppLayout><AuditPage /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/settings"     element={<ProtectedRoute><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/applications" element={<ProtectedRoute><AppLayout><ApplicationsPage /></AppLayout></ProtectedRoute>} />

      {/* ── Catch old routes ── */}
      <Route path="/dashboard"   element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/borrowers"   element={<Navigate to="/admin/borrowers" replace />} />
      <Route path="/loans"       element={<Navigate to="/admin/loans" replace />} />
      <Route path="/collection"  element={<Navigate to="/admin/collection" replace />} />
      <Route path="/forecast"    element={<Navigate to="/admin/forecast" replace />} />
      <Route path="/audit"       element={<Navigate to="/admin/audit" replace />} />
      <Route path="/settings"    element={<Navigate to="/admin/settings" replace />} />
    </Routes>
  )
}

export default function App() {
  const [appLoaded, setAppLoaded] = useState(false)
  if (!appLoaded) return <LoadingScreen onComplete={() => setAppLoaded(true)} />
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
