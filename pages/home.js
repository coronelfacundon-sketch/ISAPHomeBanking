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
      {/* Card con información de la cuenta */}
      {account ? (
        <div className="card">
          <h2>Cuenta</h2>
          <p><strong>Alias:</strong> {account.alias}</p>
          <p><strong>CBU:</strong> {account.cbu}</p>
          <p><strong>Saldo:</strong> {formatMoney(account.balance)}</p>
          <p><strong>Estimado en USD:</strong> {estimateUSD(account.balance)}</p>
        </div>
      ) : (
        <p>Cargando cuenta...</p>
      )}
      {/* Card de transferencia */}
      <div className="card">
        <h2>Transferir fondos</h2>
        <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '400px' }}>
          <label>
            Alias o CBU destino
            <input
              type="text"
              className="input"
              value={transfer.dest}
              onChange={(e) => setTransfer((prev) => ({ ...prev, dest: e.target.value }))}
              required
            />
          </label>
          <label>
            Monto (ARS)
            <input
              type="number"
              className="input"
              min="0"
              step="0.01"
              value={transfer.amount}
              onChange={(e) => setTransfer((prev) => ({ ...prev, amount: e.target.value }))}
              required
            />
          </label>
          <label>
            Concepto (opcional)
            <input
              type="text"
              className="input"
              value={transfer.concept}
              onChange={(e) => setTransfer((prev) => ({ ...prev, concept: e.target.value }))}
            />
          </label>
          <button type="submit" className="button">Transferir</button>
        </form>
      </div>
      {/* Card de solicitud de préstamos */}
      <div className="card">
        <h2>Solicitar préstamo</h2>
        <form onSubmit={handleLoanRequest} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '300px' }}>
          <label>
            Monto (ARS)
            <input
              type="number"
              className="input"
              min="0"
              step="0.01"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="button">Solicitar préstamo</button>
        </form>
      </div>
      {/* Card de movimientos recientes */}
      <div className="card">
        <h2>Movimientos recientes</h2>
        {movements && movements.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Detalle</th>
                <th style={{ textAlign: 'right' }}>Débito</th>
                <th style={{ textAlign: 'right' }}>Crédito</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
                <th>Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.date).toLocaleDateString()}</td>
                  <td>{m.concept || m.detail}</td>
                  <td style={{ textAlign: 'right' }}>{m.debit ? formatMoney(m.debit) : '-'}</td>
                  <td style={{ textAlign: 'right' }}>{m.credit ? formatMoney(m.credit) : '-'}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(m.balance_after)}</td>
                  <td>
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
      {/* Enlace al extracto completo */}
      <div className="card" style={{ textAlign: 'center' }}>
        <a href="/extract" style={{ color: '#4da8da', textDecoration: 'underline' }}>Ir al extracto completo</a>
      </div>
      {error && <p className="msg-error">{error}</p>}
      {message && <p className="msg-success">{message}</p>}
    </div>
  );
}