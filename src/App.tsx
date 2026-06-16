import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, initAuth } from '@/store/authStore'
import MainLayout from '@/layouts/MainLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import RealtimeMonitor from '@/pages/RealtimeMonitor'
import AlertManagement from '@/pages/AlertManagement'
import EnergyAnalysis from '@/pages/EnergyAnalysis'
import OperationsManagement from '@/pages/OperationsManagement'
import WeeklyReportPage from '@/pages/WeeklyReport'

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const isLoggedIn = useAuthStore(state => state.isLoggedIn)
  return isLoggedIn ? children : <Navigate to="/login" replace />
}

function App() {
  useEffect(() => {
    initAuth()
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="monitor" element={<RealtimeMonitor />} />
        <Route path="alerts" element={<AlertManagement />} />
        <Route path="energy" element={<EnergyAnalysis />} />
        <Route path="operations" element={<OperationsManagement />} />
        <Route path="report" element={<WeeklyReportPage />} />
      </Route>
    </Routes>
  )
}

export default App
