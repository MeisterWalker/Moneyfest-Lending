import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './components/Toast'
import LoadingScreen from './components/LoadingScreen'
import Sidebar from './components/Sidebar'
import NotificationBell from './components/NotificationBell'
import { useAutoLogout } from './hooks/useAutoLogout'
import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase'
import './index.css'
import './mobile.css'

// FIX 3: Lazy-load all page-level components for route-based code splitting
const LoginPage          = lazy(() => import('./pages/LoginPage'))
const BorrowersPage      = lazy(() => import('./pages/BorrowersPage'))
const LoansPage          = lazy(() => import('./pages/LoansPage'))
const DashboardPage      = lazy(() => import('./pages/DashboardPage'))
const SettingsPage       = lazy(() => import('./pages/SettingsPage'))
const AuditPage          = lazy(() => import('./pages/AuditPage'))
const ForecastPage       = lazy(() => import('./pages/ForecastPage'))
const CollectionPage     = lazy(() => import('./pages/CollectionPage'))
const ApplicationsPage   = lazy(() => import('./pages/ApplicationsPage'))
const PublicApplyPage    = lazy(() => import('./pages/PublicApplyPage'))
const BorrowerPortalPage = lazy(() => import('./pages/BorrowerPortalPage'))
const FAQPage            = lazy(() => import('./pages/FAQPage'))
const LoginLogsPage      = lazy(() => import('./pages/LoginLogsPage'))
const ApprovalsPage      = lazy(() => import('./pages/ApprovalsPage'))
const HomePage           = lazy(() => import('./pages/HomePage'))
const PrivacyPage        = lazy(() => import('./pages/PrivacyPage'))
const InvestorPitchPage  = lazy(() => import('./pages/InvestorPitchPage'))
const TermsPage          = lazy(() => import('./pages/TermsPage'))
const ContactPage        = lazy(() => import('./pages/ContactPage'))
const PartnersPage       = lazy(() => import('./pages/PartnersPage'))
const InvestorDashboard  = lazy(() => import('./pages/InvestorDashboard'))
const InvestorsPage      = lazy(() => import('./pages/InvestorsPage'))
const AssessmentPage     = lazy(() => import('./pages/AssessmentPage'))
const AssessmentForm     = lazy(() => import('./pages/AssessmentForm'))
const AdminToolsPage     = lazy(() => import('./pages/AdminToolsPage'))
const InboxPage          = lazy(() => import('./pages/InboxPage'))
const CapitalPage        = lazy(() => import('./pages/CapitalPage'))
const CapitalForecastPage = lazy(() => import('./pages/CapitalForecastPage'))


function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return user ? children : <Navigate to="/admin" replace />
}

function AppLayout({ children }) {
  const [timeoutMinutes, setTimeoutMinutes] = useState(30)

  useEffect(() => {
    supabase.from('settings').select('auto_logout_minutes').eq('id', 1).single()
      .then(({ data }) => { if (data?.auto_logout_minutes) setTimeoutMinutes(data.auto_logout_minutes) })
  }, [])

  useAutoLogout(timeoutMinutes)

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
    // FIX 3: Suspense wraps all lazy-loaded route components
    <Suspense fallback={<div style={{ padding: 32, color: 'var(--text-muted)', textAlign: 'center' }}>Loading...</div>}>
      <Routes>
        {/* ── Public routes ── */}
        <Route path="/"              element={<HomePage />} />
        <Route path="/apply"         element={<PublicApplyPage />} />
        <Route path="/portal"        element={<BorrowerPortalPage />} />
        <Route path="/faq"           element={<FAQPage />} />
        <Route path="/investor/dashboard" element={<InvestorDashboard />} />

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
        <Route path="/admin/assessments"  element={<ProtectedRoute><AppLayout><AssessmentPage /></AppLayout></ProtectedRoute>} />
        <Route path="/admin/assessment/:id" element={<ProtectedRoute><AppLayout><AssessmentForm /></AppLayout></ProtectedRoute>} />
        <Route path="/admin/login-logs"    element={<ProtectedRoute><AppLayout><LoginLogsPage /></AppLayout></ProtectedRoute>} />
        <Route path="/admin/approvals"     element={<ProtectedRoute><AppLayout><ApprovalsPage /></AppLayout></ProtectedRoute>} />
        <Route path="/privacy"           element={<PrivacyPage />} />
        <Route path="/admin/investor-pitch" element={<ProtectedRoute><AppLayout><InvestorPitchPage /></AppLayout></ProtectedRoute>} />
        <Route path="/admin/investors"      element={<ProtectedRoute><AppLayout><InvestorsPage /></AppLayout></ProtectedRoute>} />
        <Route path="/admin/tools"           element={<ProtectedRoute><AppLayout><AdminToolsPage /></AppLayout></ProtectedRoute>} />
        <Route path="/admin/inbox"           element={<ProtectedRoute><AppLayout><InboxPage /></AppLayout></ProtectedRoute>} />
        <Route path="/admin/capital"         element={<ProtectedRoute><AppLayout><CapitalPage /></AppLayout></ProtectedRoute>} />
        <Route 
          path="/admin/forecast-capital"
          element={
            <ProtectedRoute>
              <AppLayout>
                <CapitalForecastPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/terms"            element={<TermsPage />} />
        <Route path="/contact"          element={<ContactPage />} />
        <Route path="/partners"         element={<PartnersPage />} />

        {/* ── Catch old routes ── */}
        <Route path="/dashboard"   element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/borrowers"   element={<Navigate to="/admin/borrowers" replace />} />
        <Route path="/loans"       element={<Navigate to="/admin/loans" replace />} />
        <Route path="/collection"  element={<Navigate to="/admin/collection" replace />} />
        <Route path="/forecast"    element={<Navigate to="/admin/forecast" replace />} />
        <Route path="/audit"       element={<Navigate to="/admin/audit" replace />} />
        <Route path="/settings"    element={<Navigate to="/admin/settings" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const [appLoaded, setAppLoaded] = useState(false)
  if (!appLoaded) return <LoadingScreen onComplete={() => setAppLoaded(true)} />
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
