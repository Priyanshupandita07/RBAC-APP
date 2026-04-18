import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Login() {
  const location = useLocation()
  const navigate = useNavigate()
  const rawNextPath = new URLSearchParams(location.search).get('next') || '/'
  const nextPath = rawNextPath.startsWith('/') ? rawNextPath : '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('signin')
  const [success, setSuccess] = useState('')

  // Prevent duplicate auth requests (e.g. Enter key + click) which can trigger
  // Supabase `email rate limit exceeded` for signUp.
  const authInFlightRef = useRef(false)

  const signIn = async () => {
    if (authInFlightRef.current) return
    authInFlightRef.current = true
    setLoading(true); setError(''); setSuccess('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else navigate(nextPath)
    } finally {
      setLoading(false)
      authInFlightRef.current = false
    }
  }

  const signUp = async () => {
    if (authInFlightRef.current) return

    const trimmedEmail = email.trim().toLowerCase()
    const cooldownKey = `signupCooldown:${trimmedEmail}`
    const cooldownUntilRaw = localStorage.getItem(cooldownKey)
    const cooldownUntil = cooldownUntilRaw ? Number(cooldownUntilRaw) : 0
    const now = Date.now()
    // Small client-side throttle to avoid repeated signUp requests
    // immediately after a failure (which can trigger Supabase email rate limits).
    if (trimmedEmail && cooldownUntil && now < cooldownUntil) {
      setError('Please try again in a minute.')
      return
    }

    authInFlightRef.current = true
    setLoading(true); setError(''); setSuccess('')
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setSuccess('Check your email to confirm your account!')
    } finally {
      setLoading(false)
      authInFlightRef.current = false
    }

    // If signUp errors, Supabase will handle the longer cooldown; we just prevent
    // rapid retries while the request settles.
    if (trimmedEmail) {
      localStorage.setItem(cooldownKey, String(Date.now() + 60 * 1000))
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />

      {/* Left branding panel */}
      <div className="login-left">
        <div className="login-brand">
          <div className="login-brand-icon">🛡️</div>
          <span className="login-brand-name">RBAC Studio</span>
        </div>

        <h1 className="login-headline">
          Access control<br />
          <span>built for teams.</span>
        </h1>

        <p className="login-tagline">
          Manage organizations, members, and permissions — all in one polished workspace.
        </p>

        <div className="login-features">
          {[
            'Role-based access: owner, admin, member',
            'Invite team members via secure links',
            'Collaborative task management per org',
            'Seamless organization switching',
          ].map((f, i) => (
            <div className="login-feature" key={i} style={{ animationDelay: `${0.3 + i * 0.06}s` }}>
              <div className="login-feature-dot" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right card */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-card-title">
            {tab === 'signin' ? 'Welcome back' : 'Create account'}
          </div>
          <div className="login-card-subtitle">
            {tab === 'signin'
              ? 'Sign in to your workspace'
              : 'Start managing your organizations'}
          </div>

          <div className="login-tabs">
            <button
              className={`login-tab ${tab === 'signin' ? 'active' : ''}`}
              onClick={() => { setTab('signin'); setError(''); setSuccess(''); }}
            >Sign In</button>
            <button
              className={`login-tab ${tab === 'signup' ? 'active' : ''}`}
              onClick={() => { setTab('signup'); setError(''); setSuccess(''); }}
            >Sign Up</button>
          </div>

          {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
          {success && <div className="success-message" style={{ marginBottom: '16px' }}>{success}</div>}

          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (tab === 'signin' ? signIn() : signUp())}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (tab === 'signin' ? signIn() : signUp())}
            />
          </div>

          <div className="login-actions">
            {tab === 'signin' ? (
              <button className="btn-primary" onClick={signIn} disabled={loading} style={{ justifyContent: 'center', padding: '12px' }}>
                {loading ? 'Signing in…' : '→ Sign In'}
              </button>
            ) : (
              <button className="btn-primary" onClick={signUp} disabled={loading} style={{ justifyContent: 'center', padding: '12px' }}>
                {loading ? 'Creating account…' : '→ Create Account'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
