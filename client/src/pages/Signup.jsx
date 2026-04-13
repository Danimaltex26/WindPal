import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  var auth = useAuth();
  var user = auth.user;
  var signUp = auth.signUp;
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!agreedToTerms) { setError('You must agree to the Terms of Service and Privacy Policy'); return; }
    setLoading(true);
    try {
      await signUp(email, password, displayName.trim() || undefined);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100dvh', padding: '1.5rem', maxWidth: 420, margin: '0 auto', width: '100%' }}>
        <div className="stack">
          <div className="text-center">
            <img src="/logo.png" alt="WindPal" style={{ width: 260, marginBottom: '0.5rem', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
            <p className="text-secondary">Create your account</p>
          </div>

          {error && <div className="error-banner">{error}</div>}

          {success ? (
            <div className="info-box">
              Account created! Check your email to confirm, then <Link to="/login">sign in</Link>.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="stack">
              <div className="form-group">
                <label htmlFor="displayName">Name</label>
                <input id="displayName" type="text" className="input" placeholder="Your name" value={displayName} onChange={function (e) { setDisplayName(e.target.value); }} autoComplete="name" />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" className="input" placeholder="you@example.com" value={email} onChange={function (e) { setEmail(e.target.value); }} required autoComplete="email" />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" className="input" placeholder="At least 6 characters" value={password} onChange={function (e) { setPassword(e.target.value); }} required autoComplete="new-password" />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input id="confirmPassword" type="password" className="input" placeholder="Repeat your password" value={confirmPassword} onChange={function (e) { setConfirmPassword(e.target.value); }} required autoComplete="new-password" />
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8125rem', color: '#A0A0A8', cursor: 'pointer', lineHeight: 1.5 }}>
                <input type="checkbox" checked={agreedToTerms} onChange={function (e) { setAgreedToTerms(e.target.checked); }} style={{ marginTop: 3, flexShrink: 0, accentColor: '#10B981' }} />
                <span>
                  I agree to the{' '}
                  <a href="https://tradepals.net/windpal/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#10B981' }}>Terms of Service</a>{' '}
                  and{' '}
                  <a href="https://tradepals.net/windpal/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#10B981' }}>Privacy Policy</a>.
                </span>
              </label>

              <button type="submit" className="btn btn-primary btn-block" disabled={loading || !agreedToTerms}>
                {loading ? 'Creating account...' : 'Sign Up'}
              </button>
            </form>
          )}

          <p className="text-center text-secondary" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </div>
    </div>
  );
}
