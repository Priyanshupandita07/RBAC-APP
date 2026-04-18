import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function OrgDetail() {
  const { orgId } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [org, setOrg] = useState(null)
  const [role, setRole] = useState(null)
  const [members, setMembers] = useState([])
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [deletingOrg, setDeletingOrg] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteLink, setInviteLink] = useState('')
  const [allOrgs, setAllOrgs] = useState([])
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [notFoundReason, setNotFoundReason] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteStatus, setInviteStatus] = useState('')
  const switcherRef = useRef()

  useEffect(() => {
    if (session?.user?.id) fetchOrgData()
  }, [orgId, session?.user?.id])

  useEffect(() => {
    const handler = (e) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) {
        setShowSwitcher(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchOrgData = async () => {
    setNotFound(false)
    setNotFoundReason('')
    setLoading(true)
    if (!orgId) {
      setNotFound(true)
      setNotFoundReason('Missing orgId route param')
      setLoading(false)
      return
    }
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .limit(1)
    if (orgError || !orgData || orgData.length === 0) {
      setNotFound(true)
      setNotFoundReason(
        `ORG_SELECT: ${orgError?.message || `no row (orgId=${String(orgId)})`}`
      )
      setLoading(false)
      return
    }
    setOrg(orgData[0])

    const { data: memberExistRows, error: memberExistErr } = await supabase
      .from('members')
      .select('org_id')
      .eq('org_id', orgId)
      .eq('user_id', session.user.id)
      .limit(1)

    if (memberExistErr || !memberExistRows || memberExistRows.length === 0) {
      setNotFound(true)
      setNotFoundReason(
        `MEMBER_CHECK: ${
          memberExistErr?.message ||
          `user not found in members (orgId=${String(orgId)})`
        }`
      )
      setLoading(false)
      return
    }

    const { data: memberRoleRows } = await supabase
      .from('members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', session.user.id)
      .limit(1)

    setRole(memberRoleRows?.[0]?.role || null)

    const { data: membersData } = await supabase
      .from('members')
      .select('*')
      .eq('org_id', orgId)
    setMembers(membersData || [])

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .eq('org_id', orgId)
    setTasks(tasksData || [])

    const { data: allOrgsData } = await supabase
      .from('organizations')
      .select('*')
    setAllOrgs(allOrgsData || [])

    setLoading(false)
  }

  const addTask = async () => {
    if (!newTask.trim()) return
    const { error } = await supabase.from('tasks').insert({
      title: newTask, org_id: orgId, created_by: session.user.id
    })
    if (!error) { setNewTask(''); fetchOrgData() }
  }

  const toggleTask = async (task) => {
    await supabase.from('tasks').update({ is_complete: !task.is_complete }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_complete: !t.is_complete } : t))
  }

  const createInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviteSending(true)
    setInviteStatus('')

    const emailToSend = inviteEmail
    const token = crypto.randomUUID()
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabase
      .from('invites')
      .insert({
        org_id: orgId,
        email: emailToSend,
        role: inviteRole,
        token,
        expires_at,
        created_by: session.user.id
      })

    if (error) {
      console.error(error)
      setInviteStatus('❌ Failed to create invite.')
      setInviteSending(false)
      return
    }

    const link = `${window.location.origin}/invite/${token}`
    setInviteLink(link)
    setInviteEmail('')

    try {
      const res = await fetch('https://gsioljukmxokkcpopfgq.supabase.co/functions/v1/send-invite-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzaW9sanVrbXhva2tjcG9wZmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDQ3OTEsImV4cCI6MjA5MTQ4MDc5MX0._8nv-LpdVBaUIMGPLhf3ooqAfroCZWH2gHqWTKkC18I`
        },
        body: JSON.stringify({
          to: emailToSend,
          inviteLink: link,
          orgName: org.name,
          role: inviteRole
        })
      })
      const data = await res.json()
      console.log('Edge function response:', res.status, data)
      if (!res.ok) {
        setInviteStatus('⚠️ Invite created but email failed to send.')
      } else {
        setInviteStatus('✅ Invite sent successfully!')
      }
    } catch (err) {
      console.error('Edge function error:', err)
      setInviteStatus('⚠️ Invite created but email failed to send.')
    } finally {
      setInviteSending(false)
    }
  }

  const deleteOrg = async () => {
    if (deletingOrg) return
    const isOwnerOrAdmin = role === 'owner' || role === 'admin'
    if (!isOwnerOrAdmin) return

    const confirmed = window.confirm(
      `Delete organization "${org?.name || ''}"?\n\nThis will remove its tasks, members, and invites.`
    )
    if (!confirmed) return

    setDeletingOrg(true)
    setDeleteError('')

    const toMsg = (e) => e?.message || e?.error_description || e?.hint || 'Unknown error'

    try {
      const { data: deletedInvites, error: invitesErr } = await supabase
        .from('invites')
        .delete()
        .eq('org_id', orgId)
        .select('id')
      if (invitesErr) throw new Error(`Invites delete failed: ${toMsg(invitesErr)}`)

      const { data: deletedTasks, error: tasksErr } = await supabase
        .from('tasks')
        .delete()
        .eq('org_id', orgId)
        .select('id')
      if (tasksErr) throw new Error(`Tasks delete failed: ${toMsg(tasksErr)}`)

      const { data: deletedMembers, error: membersErr } = await supabase
        .from('members')
        .delete()
        .eq('org_id', orgId)
        .select('id')
      if (membersErr) throw new Error(`Members delete failed: ${toMsg(membersErr)}`)

      const { data: deletedOrgs, error: orgErr } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId)
        .select('id')
      if (orgErr) throw new Error(`Organization delete failed: ${toMsg(orgErr)}`)

      const deletedCount = deletedOrgs?.length || 0
      if (deletedCount === 0) {
        throw new Error(
          `No organization row matched (deleted 0 organizations).` +
          ` Deleted children anyway? invites=${(deletedInvites?.length || 0)}, tasks=${(deletedTasks?.length || 0)}, members=${(deletedMembers?.length || 0)}. ` +
          `This usually means RLS DELETE policy on "organizations" blocked your delete (0 rows affected).`
        )
      }

      navigate('/')
    } catch (err) {
      setDeleteError(err?.message || 'Failed to delete organization.')
      setDeletingOrg(false)
    }
  }

  const signOut = async () => await supabase.auth.signOut()

  const emailInitial = session?.user?.email?.[0]?.toUpperCase() || '?'
  const completedCount = tasks.filter(t => t.is_complete).length

  if (loading) return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🛡️</div>
          <span className="sidebar-logo-text">RBAC Studio</span>
        </div>
      </aside>
      <div className="main-content">
        <div className="loader-wrap">
          <div className="loader-ring" />
          <span className="loader-text">Loading workspace…</span>
        </div>
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div style={{ textAlign: 'center', padding: '40px', animation: 'fadeUp 0.4s both' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8 }}>Organization not found</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>This org doesn't exist or you don't have access.</p>
        {notFoundReason && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 18, maxWidth: 520 }}>
            Debug: {notFoundReason}
          </div>
        )}
        <button className="btn-primary" onClick={() => navigate('/')}>← Go to Dashboard</button>
      </div>
    </div>
  )

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🛡️</div>
          <span className="sidebar-logo-text">RBAC Studio</span>
        </div>

        <div className="sidebar-org-section" ref={switcherRef} style={{ position: 'relative' }}>
          <button className="org-switcher-btn" onClick={() => setShowSwitcher(!showSwitcher)}>
            <div className="org-avatar">{org?.name[0]?.toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="org-switcher-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org?.name}</div>
              <div className="org-switcher-role">{role}</div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, transform: showSwitcher ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
          </button>
          {showSwitcher && (
            <div className="dropdown" style={{ left: 0, right: 0, top: 'calc(100% + 4px)' }}>
              {allOrgs.map(o => (
                <div
                  key={o.id}
                  className={`dropdown-item ${o.id === orgId ? 'active' : ''}`}
                  onClick={() => { navigate(`/org/${o.id}`); setShowSwitcher(false); setSidebarOpen(false) }}
                >
                  <div style={{ width: 22, height: 22, background: 'var(--accent-dim)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                    {o.name[0]?.toUpperCase()}
                  </div>
                  {o.name}
                  {o.id === orgId && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Navigation</div>
          <div className="sidebar-nav-item" onClick={() => { navigate('/'); setSidebarOpen(false) }}>
            <span>🏠</span> All Organizations
          </div>
          <div className="sidebar-nav-item active">
            <span>✅</span> Tasks
          </div>
          {(role === 'owner' || role === 'admin') && (
            <div className="sidebar-nav-item active" style={{ opacity: 0.7 }}>
              <span>👥</span> Members
            </div>
          )}
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

      <div className="main-content">
        <div className="mobile-header">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{org?.name}</span>
          <span className={`badge badge-${role}`} style={{ marginLeft: 'auto' }}>{role}</span>
        </div>

        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h1 className="page-title">{org?.name}</h1>
              <p className="page-subtitle">
                Workspace overview · <span className={`badge badge-${role}`} style={{ verticalAlign: 'middle' }}>{role}</span>
              </p>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Your role in this org: {role || 'not a member'}
              </div>
            </div>

            {(role === 'owner' || role === 'admin') && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <button
                  className="btn-secondary"
                  onClick={deleteOrg}
                  disabled={deletingOrg}
                  style={{
                    padding: '10px 12px',
                    borderColor: 'rgba(239,68,68,0.35)',
                    color: 'rgb(239 68 68)',
                    background: 'rgba(239,68,68,0.06)'
                  }}
                >
                  {deletingOrg ? 'Deleting…' : 'Delete org'}
                </button>
                {deleteError && (
                  <div style={{ maxWidth: 360, color: 'rgb(239 68 68)', fontSize: 12, textAlign: 'right' }}>
                    {deleteError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="page-body">
          <div className="stats-row">
            <div className="stat-card" style={{ animationDelay: '0.05s' }}>
              <div className="stat-value" style={{ color: 'var(--accent)' }}>{tasks.length}</div>
              <div className="stat-label">Total Tasks</div>
            </div>
            <div className="stat-card" style={{ animationDelay: '0.1s' }}>
              <div className="stat-value" style={{ color: 'var(--green)' }}>{completedCount}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-card" style={{ animationDelay: '0.15s' }}>
              <div className="stat-value" style={{ color: 'var(--teal)' }}>{members.length}</div>
              <div className="stat-label">Members</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20, animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s both' }}>
            <div className="section-header">
              <div className="section-title">Tasks</div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{completedCount}/{tasks.length} done</span>
            </div>

            <div className="input-row" style={{ marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Add a new task…"
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
              />
              <button className="btn-primary" onClick={addTask} disabled={!newTask.trim()} style={{ flex: '0 0 auto' }}>
                + Add
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-title">No tasks yet</div>
                <div className="empty-state-desc">Add your first task above.</div>
              </div>
            ) : (
              tasks.map((task, i) => (
                <div
                  key={task.id}
                  className={`task-item ${task.is_complete ? 'done' : ''}`}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div
                    className={`task-checkbox ${task.is_complete ? 'checked' : ''}`}
                    onClick={() => toggleTask(task)}
                  />
                  <span className={`task-title ${task.is_complete ? 'done' : ''}`}>{task.title}</span>
                </div>
              ))
            )}
          </div>

          {(role === 'owner' || role === 'admin') && (
            <div className="card" style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.25s both' }}>
              <div className="section-title" style={{ marginBottom: 14 }}>Members</div>

              {members.map((member, i) => (
                <div key={member.id} className="member-item" style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="member-avatar">👤</div>
                  <div className="member-info">
                    <div className="member-id">{member.user_id}</div>
                  </div>
                  <span className={`badge badge-${member.role}`}>{member.role}</span>
                </div>
              ))}

              <div className="divider" />

              <div className="section-title" style={{ marginBottom: 14 }}>Invite Member</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  style={{ flex: '1 1 180px', minWidth: 0 }}
                  onKeyDown={e => e.key === 'Enter' && createInvite()}
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  style={{ flex: '0 0 120px' }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  className="btn-primary"
                  onClick={createInvite}
                  disabled={!inviteEmail.trim() || inviteSending}
                  style={{ flex: '0 0 auto' }}
                >
                  {inviteSending ? 'Sending…' : 'Send Invite'}
                </button>
              </div>

              {inviteStatus && (
                <div style={{ marginTop: 10, fontSize: 13, color: inviteStatus.startsWith('✅') ? 'var(--green)' : 'var(--text-secondary)' }}>
                  {inviteStatus}
                </div>
              )}

              {inviteLink && (
                <div className="invite-box">
                  <div className="invite-box-label">🔗 Invite Link Ready</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inviteLink}</span>
                    <button
                      className="btn-secondary btn-sm"
                      style={{ flex: '0 0 auto' }}
                      onClick={() => navigator.clipboard.writeText(inviteLink)}
                    >Copy</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}