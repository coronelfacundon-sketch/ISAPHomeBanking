import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/router';

/**
 * Home page for approved clients. Displays account information, allows the
 * user to initiate transfers, request loans, and view recent movements.
 */
export default function HomePage({ user }) {
  const router = useRouter();
  const [account, setAccount] = useState(null);
  const [movements, setMovements] = useState([]);
  const [transfer, setTransfer] = useState({ dest: '', amount: '', concept: '' });
  const [loanAmount, setLoanAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Redirect unauthorized users
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'client' || user.status !== 'approved') {
      router.replace('/');
    }
  }, [user, router]);

  // Fetch account and movements on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      // Fetch the single account for this user
      const { data: acc, error: accErr } = await supabase
        .from('accounts')
        .select('*')
        .eq('uid', user.id)
        .single();
      if (!accErr) {
        setAccount(acc);
      }
      // Fetch recent movements
      const { data: movs, error: movErr } = await supabase
        .from('movements')
        .select('*')
        .eq('uid', user.id)
        .order('date', { ascending: false })
        .limit(10);
      if (!movErr) {
        setMovements(movs);
      }
    };
    fetchData();
  }, [user]);

  // Handler for transfer form
  const handleTransfer = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const amountCents = Math.round(parseFloat(transfer.amount || '0') * 100);
    if (!transfer.dest || !amountCents || amountCents <= 0) {
      setError('Ingrese destino y monto válido.');
      return;
    }
    try {
      const { error: rpcErr } = await supabase.rpc('transfer_funds', {
        origin_uid: user.id,
        dest_input: transfer.dest,
        amount_cents: amountCents,
        transfer_concept: transfer.concept || ''
      });
      if (rpcErr) {
        setError(rpcErr.message);
      } else {
        setMessage('Transferencia realizada con éxito.');
        // Refresh movements and account
        const { data: accData } = await supabase
          .from('accounts')
          .select('*')
          .eq('uid', user.id)
          .single();
        setAccount(accData);
        const { data: movs } = await supabase
          .from('movements')
          .select('*')
          .eq('uid', user.id)
          .order('date', { ascending: false })
          .limit(10);
        setMovements(movs);
        // Reset transfer form
        setTransfer({ dest: '', amount: '', concept: '' });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Handler for loan request
  const handleLoanRequest = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const amtCents = Math.round(parseFloat(loanAmount || '0') * 100);
    if (!amtCents || amtCents <= 0) {
      setError('Ingrese un monto válido para el préstamo.');
      return;
    }
    const { error: loanErr } = await supabase.from('loans').insert({
      uid: user.id,
      amount: amtCents,
      status: 'pending'
    });
    if (loanErr) {
      setError(loanErr.message);
    } else {
      setMessage('Solicitud de préstamo enviada.');
      setLoanAmount('');
    }
  };

  // Format currency from cents to ARS string
  const formatMoney = (cents) => {
    if (cents === null || cents === undefined) return '-';
    return `ARS ${ (cents / 100).toFixed(2) }`;
  };

  // Estimate USD conversion (static rate e.g. 1 USD = 350 ARS)
  const estimateUSD = (cents) => {
    const rate = 350; // Example fixed rate
    return `$${ (cents / 100 / rate).toFixed(2) } USD`;
  };

  return (
    <div>
      <h1>Bienvenido, {user?.company_name}</h1>
      {account ? (
        <div style={{ backgroundColor: '#013a63', padding: '1rem', borderRadius: '6px', marginTop: '1rem' }}>
          <h2>Cuenta</h2>
          <p>Alias: {account.alias}</p>
          <p>CBU: {account.cbu}</p>
          <p>Saldo: {formatMoney(account.balance)}</p>
          <p>Estimado en USD: {estimateUSD(account.balance)}</p>
        </div>
      ) : (
        <p>Cargando cuenta...</p>
      )}
      {/* Transfer Form */}
      <div style={{ marginTop: '2rem' }}>
        <h2>Transferir fondos</h2>
        <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '400px' }}>
          <label>
            Alias o CBU destino
            <input
              type="text"
              value={transfer.dest}
              onChange={(e) => setTransfer((prev) => ({ ...prev, dest: e.target.value }))}
              required
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </label>
          <label>
            Monto (ARS)
            <input
              type="number"
              min="0"
              step="0.01"
              value={transfer.amount}
              onChange={(e) => setTransfer((prev) => ({ ...prev, amount: e.target.value }))}
              required
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </label>
          <label>
            Concepto (opcional)
            <input
              type="text"
              value={transfer.concept}
              onChange={(e) => setTransfer((prev) => ({ ...prev, concept: e.target.value }))}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </label>
          <button
            type="submit"
            style={{ padding: '0.6rem', backgroundColor: '#026c69', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Transferir
          </button>
        </form>
      </div>
      {/* Loan Request */}
      <div style={{ marginTop: '2rem' }}>
        <h2>Solicitar préstamo</h2>
        <form onSubmit={handleLoanRequest} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '300px' }}>
          <label>
            Monto (ARS)
            <input
              type="number"
              min="0"
              step="0.01"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </label>
          <button
            type="submit"
            style={{ padding: '0.6rem', backgroundColor: '#026c69', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Solicitar préstamo
          </button>
        </form>
      </div>
      {/* Recent Movements */}
      <div style={{ marginTop: '2rem' }}>
        <h2>Movimientos recientes</h2>
        {movements && movements.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Fecha</th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Detalle</th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem', textAlign: 'right' }}>Débito</th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem', textAlign: 'right' }}>Crédito</th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem', textAlign: 'right' }}>Saldo</th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td style={{ padding: '0.5rem' }}>{new Date(m.date).toLocaleDateString()}</td>
                  <td style={{ padding: '0.5rem' }}>{m.concept || m.detail}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{m.debit ? formatMoney(m.debit) : '-'}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{m.credit ? formatMoney(m.credit) : '-'}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(m.balance_after)}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <a href={`/receipt?tx=${m.tx_id}`} style={{ color: '#4da8da', textDecoration: 'underline' }}>Ver</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No hay movimientos recientes.</p>
        )}
      </div>
      {/* Extract link */}
      <div style={{ marginTop: '2rem' }}>
        <a href="/extract" style={{ color: '#4da8da', textDecoration: 'underline' }}>Ir al extracto completo</a>
      </div>
      {error && <p style={{ color: 'salmon', marginTop: '1rem' }}>{error}</p>}
      {message && <p style={{ color: 'lightyellow', marginTop: '1rem' }}>{message}</p>}
    </div>
  );
}