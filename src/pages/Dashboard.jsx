import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const inputRef = useRef()

  useEffect(() => {
    if (session?.user?.id) fetchOrgs()
  }, [session?.user?.id])

  const fetchOrgs = async () => {
    if (!session?.user?.id) return
    setLoading(true)

    // Only show organizations where the current user is a member.
    const { data: memberRows, error: memberErr } = await supabase
      .from('members')
      .select('org_id')
      .eq('user_id', session.user.id)

    if (memberErr) {
      setOrgs([])
      setLoading(false)
      return
    }

    const orgIds = (memberRows || []).map(r => r.org_id).filter(Boolean)
    if (orgIds.length === 0) {
      setOrgs([])
      setLoading(false)
      return
    }

    const { data: orgData, error: orgErr } = await supabase
      .from('organizations')
      .select('*')
      .in('id', orgIds)

    if (!orgErr) setOrgs(orgData || [])
    setLoading(false)
  }

  const createOrg = async () => {
    if (!orgName.trim()) return
    setLoading(true)
    const { error } = await supabase.rpc('create_org_with_owner', { org_name: orgName })
    if (!error) { setOrgName(''); await fetchOrgs() }
    else setLoading(false)
  }

  const signOut = async () => await supabase.auth.signOut()

  const emailInitial = session?.user?.email?.[0]?.toUpperCase() || '?'

  return (
    <div className="app-layout">
      {/* Sidebar Overlay (mobile) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🛡️</div>
          <span className="sidebar-logo-text">RBAC Studio</span>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Navigation</div>
          <div className="sidebar-nav-item active">
            <span>🏢</span> Organizations
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="user-avatar">{emailInitial}</div>
            <div className="user-info">
              <div className="user-email">{session?.user?.email}</div>
              <button className="signout-btn" onClick={signOut}>Sign out</button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        {/* Mobile Header */}
        <div className="mobile-header">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="sidebar-logo-icon" style={{ width: 28, height: 28, fontSize: 14 }}>🛡️</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16 }}>RBAC Studio</span>
        </div>

        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 className="page-title">Organizations</h1>
              <p className="page-subtitle">Manage your workspaces and teams</p>
            </div>
          </div>
        </div>

        <div className="page-body">
          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card" style={{ animationDelay: '0.05s' }}>
              <div className="stat-value" style={{ color: 'var(--accent)' }}>{orgs.length}</div>
              <div className="stat-label">Organizations</div>
            </div>
            <div className="stat-card" style={{ animationDelay: '0.1s' }}>
              <div className="stat-value" style={{ color: 'var(--teal)' }}>Active</div>
              <div className="stat-label">Account Status</div>
            </div>
          </div>

          {/* Create Org */}
          <div className="card" style={{ marginBottom: 24, animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s both' }}>
            <div className="section-title" style={{ marginBottom: 14 }}>Create Organization</div>
            <div className="input-row">
              <input
                ref={inputRef}
                type="text"
                placeholder="e.g. Acme Corp, Design Team…"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createOrg()}
              />
              <button
                className="btn-primary"
                onClick={createOrg}
                disabled={loading || !orgName.trim()}
                style={{ flex: '0 0 auto' }}
              >
                {loading ? '…' : '+ Create'}
              </button>
            </div>
          </div>

          {/* Orgs List */}
          <div className="section-header">
            <div className="section-title">Your Workspaces</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{orgs.length} total</span>
          </div>

          {orgs.length === 0 ? (
            <div className="empty-state" style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.2s both' }}>
              <div className="empty-state-icon">🏢</div>
              <div className="empty-state-title">No organizations yet</div>
              <div className="empty-state-desc">Create your first organization above to get started.</div>
            </div>
          ) : (
            orgs.map((org, i) => (
              <div
                key={org.id}
                className="org-card"
                style={{ animationDelay: `${0.15 + i * 0.06}s` }}
                onClick={() => navigate(`/org/${org.id}`)}
              >
                <div className="org-card-icon">{org.name[0]?.toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="org-card-name">{org.name}</div>
                  <div className="org-card-meta">Created {new Date(org.created_at).toLocaleDateString()}</div>
                </div>
                <div className="org-card-arrow">›</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
