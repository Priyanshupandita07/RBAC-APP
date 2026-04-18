import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import OrgDetail from './pages/orgDetail'
import AcceptInvite from './pages/AcceptInvite'

function AppContent() {
  const { session } = useAuth()

  return (
    <Routes>
      <Route path="/invite/:token" element={<AcceptInvite />} />
      {!session ? (
        <Route path="*" element={<Login />} />
      ) : (
        <>
          <Route path="/" element={<Dashboard />} />
          <Route path="/org/:orgId" element={<OrgDetail />} />
        </>
      )}
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}