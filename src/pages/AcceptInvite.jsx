import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function AcceptInvite() {
  const { token } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const invitePath = `/invite/${token}`
  const loginNextPath = `/login?next=${encodeURIComponent(invitePath)}`
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const lastAcceptedKeyRef = useRef('')
  const acceptInFlightRef = useRef(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [accountMismatch, setAccountMismatch] = useState(false)

  useEffect(() => {
    // Do not auto-accept invites just because a session exists.
    // We additionally verify that the signed-in user matches the invite email.
    const run = async () => {
      setError('')
      setInviteEmail('')
      setAccountMismatch(false)

      if (!session) {
        setStatus('need_signin')
        return
      }

      setStatus('loading')
      try {
        const { data, error: inviteErr } = await supabase
          .from('invites')
          .select('email')
          .eq('token', token)
          .maybeSingle()

        const expectedEmail = data?.email || ''
        setInviteEmail(expectedEmail)

        const signedInEmail = session?.user?.email || ''
        if (expectedEmail && signedInEmail) {
          const mismatch =
            expectedEmail.trim().toLowerCase() !== signedInEmail.trim().toLowerCase()
          setAccountMismatch(mismatch)

          // Auto-accept only when the currently signed-in user matches the invite.
          if (!mismatch) {
            // Avoid re-accept loops: acceptInvite has idempotent in-flight guards.
            acceptInvite()
          }
        }

        setStatus('ready')
        if (inviteErr) setError(inviteErr.message)
      } catch (e) {
        setStatus('ready')
        setError(e?.message || 'Failed to verify invite.')
      }
    }

    run()
  }, [session, token])

  const acceptInvite = async () => {
    const userId = session?.user?.id
    if (!userId) return
    const key = `${token}:${userId}`
    if (lastAcceptedKeyRef.current === key) return
    if (acceptInFlightRef.current) return
    acceptInFlightRef.current = true

    try {
      const { error } = await supabase.rpc('accept_invite', { invite_token: token })
      if (error) {
        setError(error.message)
        setStatus('error')
        return
      }

      // Only mark as accepted after success so transient errors can be retried.
      lastAcceptedKeyRef.current = key
      setStatus('success')
      setTimeout(() => navigate('/'), 2500)
    } finally {
      acceptInFlightRef.current = false
    }
  }

  const bgStyle = {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'var(--bg-base)', padding: 20,
    position: 'relative', overflow: 'hidden'
  }

  const glow = (pos) => ({
    position: 'absolute', width: 500, height: 500, borderRadius: '50%',
    filter: 'blur(100px)', pointerEvents: 'none', ...pos
  })

  if (!session) return (
    <div style={bgStyle}>
      <div style={{ ...glow({ top: -200, left: -100 }), background: 'radial-gradient(circle,rgba(108,142,255,0.1) 0%,transparent 70%)' }} />
      <div className="invite-card">
        <div className="invite-icon pending">✉️</div>
        <div className="invite-title">You've been invited!</div>
        <div className="invite-desc">
          Sign in or create an account to accept your invitation and join the organization.
        </div>
        <button
          className="btn-primary"
          onClick={() => navigate(loginNextPath)}
          style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
        >
          → Sign In / Sign Up
        </button>
      </div>
    </div>
  )

  if (status === 'loading') return (
    <div style={bgStyle}>
      <div className="invite-card">
        <div className="invite-icon pending">⏳</div>
        <div className="invite-title">Accepting Invite…</div>
        <div className="invite-desc">Please wait while we verify your invitation.</div>
        <div className="loader-ring" style={{ margin: '0 auto' }} />
      </div>
    </div>
  )

  if (status === 'ready') {
    return (
      <div style={bgStyle}>
        <div style={{ ...glow({ top: -200, left: -100 }), background: 'radial-gradient(circle,rgba(108,142,255,0.1) 0%,transparent 70%)' }} />
        <div className="invite-card">
          <div className="invite-icon pending">✉️</div>
          <div className="invite-title">You've been invited!</div>
          <div className="invite-desc">
            Signed in as <b>{session?.user?.email || 'unknown'}</b>. Click below to accept.
          </div>
          {inviteEmail && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Invite is for: <b>{inviteEmail}</b>
            </div>
          )}
          {accountMismatch && (
            <div style={{ marginTop: 10, width: '100%' }}>
              <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>
                Wrong account for this invite. Sign out and sign in with the invited email.
              </div>
              <button
                className="btn-secondary"
                onClick={async () => {
                  await supabase.auth.signOut()
                  navigate(loginNextPath)
                }}
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                Sign out & continue
              </button>
            </div>
          )}
          <button
            className="btn-primary"
            onClick={acceptInvite}
            disabled={acceptInFlightRef.current || accountMismatch}
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
          >
            {acceptInFlightRef.current ? 'Accepting…' : '→ Accept invitation'}
          </button>
          <button
            className="btn-secondary"
            onClick={async () => {
              await supabase.auth.signOut()
              navigate('/')
            }}
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 10 }}
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (status === 'error') return (
    <div style={bgStyle}>
      <div className="invite-card">
        <div className="invite-icon error">❌</div>
        <div className="invite-title">Invite Error</div>
        <div className="invite-desc">{error}</div>
        <button className="btn-primary" onClick={() => navigate('/')} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
          ← Go to Dashboard
        </button>
      </div>
    </div>
  )

  return (
    <div style={bgStyle}>
      <div style={{ ...glow({ top: -200, left: -100 }), background: 'radial-gradient(circle,rgba(52,211,153,0.1) 0%,transparent 70%)' }} />
      <div className="invite-card">
        <div className="invite-icon success">🎉</div>
        <div className="invite-title">Welcome aboard!</div>
        <div className="invite-desc">You've successfully joined the organization. Redirecting you to your dashboard…</div>
        <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, color: 'var(--green)' }}>
          ✓ Invitation accepted successfully
        </div>
      </div>
    </div>
  )
}
