import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  var auth = useAuth();
  var user = auth.user;
  var signIn = auth.signIn;
  var signInWithMagicLink = auth.signInWithMagicLink;
  var _email = '';
  var _password = '';
  const [email, setEmail] = useState(_email);
  const [password, setPassword] = useState(_password);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email) { setError('Enter your email first'); return; }
    setError('');
    setLoading(true);
    try {
      await signInWithMagicLink(email);
      setMagicLinkSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100dvh', padding: '1.5rem', maxWidth: 420, margin: '0 auto', width: '100%' }}>
        <div className="stack">
          <div className="text-center">
            <img src="/logo.png" alt="WindPal" style={{ width: 260, marginBottom: '0.5rem', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
            <p className="text-secondary">AI field companion for wind turbine technicians</p>
          </div>

          {error && <div className="error-banner">{error}</div>}

          {magicLinkSent ? (
            <div className="info-box">Check your email for a magic link to sign in.</div>
          ) : (
            <form onSubmit={handleSubmit} className="stack">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" className="input" placeholder="you@example.com" value={email} onChange={function (e) { setEmail(e.target.value); }} required autoComplete="email" />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" className="input" placeholder="Your password" value={password} onChange={function (e) { setPassword(e.target.value); }} required autoComplete="current-password" />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={handleMagicLink} disabled={loading}>
                Send Magic Link
              </button>
            </form>
          )}

          <p className="text-center text-secondary" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Don't have an account? <Link to="/signup">Sign Up</Link>
          </p>

          <a href="https://tradepals.net" target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', marginTop: '2rem', opacity: 0.5 }}>
            <img src="https://tradepals.net/tradepals-logo.png" alt="TradePals" style={{ height: 28, display: 'inline-block' }} />
          </a>
        </div>
    </div>
  );
}
