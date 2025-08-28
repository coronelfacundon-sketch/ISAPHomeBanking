import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/router';

/**
 * Registration page. Allows new clients (students simulating companies) to
 * register their company. Upon successful sign-up, a pending user record
 * is created in the `users` table. Employees must later approve the
 * registration to activate the account.
 */
export default function RegisterPage({ user }) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [type, setType] = useState('micro');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // If user is logged in, redirect to appropriate place
  if (user) {
    if (user.role === 'bank') {
      router.replace('/admin');
    } else if (user.status === 'approved') {
      router.replace('/home');
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    // Sign up using Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });
    if (authError) {
      setError(authError.message);
      return;
    }
    const { user: newUser } = authData;
    // Insert user profile record
    const { error: insertError } = await supabase.from('users').insert({
      id: newUser.id,
      email,
      company_name: companyName,
      type,
      role: 'client',
      status: 'pending'
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setMessage('Registro exitoso. Tu cuenta está pendiente de aprobación.');
    // Optionally sign out to prevent immediate login as pending user
    await supabase.auth.signOut();
  };

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>Registro de Cliente</h1>
      <div className="card">
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label>
            Empresa
            <input
              type="text"
              className="input"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </label>
          <label>
            Tipo de empresa
            <select
              value={type}
              className="input"
              onChange={(e) => setType(e.target.value)}
            >
              <option value="micro">Micro</option>
              <option value="pyme">PyME</option>
              <option value="gran">Gran</option>
            </select>
          </label>
          <label>
            Email
            <input
              type="email"
              className="input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              className="input"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="button">Registrarse</button>
        </form>
        {error && <p className="msg-error">{error}</p>}
        {message && <p className="msg-success">{message}</p>}
      </div>
    </div>
  );
}