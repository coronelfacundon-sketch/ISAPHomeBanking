import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/router';

/**
 * Login page. Provides a form for users to sign in with email and password.
 * Once authenticated, redirects to the appropriate dashboard based on the
 * user's role and status. If the account is pending approval, the user
 * remains on this page with a notification.
 */
export default function LoginPage({ user }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  // React to user changes: redirect or show pending message
  useEffect(() => {
    if (!user) return;
    if (user.role === 'bank') {
      router.replace('/admin');
    } else if (user.role === 'client') {
      if (user.status === 'approved') {
        router.replace('/home');
      } else {
        setMessage('Tu cuenta está pendiente de aprobación. Por favor espera.');
      }
    }
  }, [user, router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (authError) {
      setError(authError.message);
    } else {
      // After login the useUser hook will update and redirect appropriately.
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>Ingresar</h1>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </label>
        <button
          type="submit"
          style={{ padding: '0.6rem', backgroundColor: '#026c69', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Entrar
        </button>
      </form>
      {error && <p style={{ color: 'salmon', marginTop: '1rem' }}>{error}</p>}
      {message && <p style={{ color: 'lightyellow', marginTop: '1rem' }}>{message}</p>}
    </div>
  );
}