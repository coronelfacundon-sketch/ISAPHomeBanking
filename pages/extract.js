import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/router';

/**
 * Extract page allows clients to view their full account statement within a
 * selected date range, see summary totals and export the data to CSV.
 */
export default function ExtractPage({ user }) {
  const router = useRouter();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState({ initial: 0, debits: 0, credits: 0, final: 0 });
  const [error, setError] = useState('');

  // Redirect unauthorized
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'client' || user.status !== 'approved') {
      router.replace('/');
    }
  }, [user, router]);

  const fetchExtract = async () => {
    setError('');
    if (!user) return;
    let query = supabase
      .from('movements')
      .select('*')
      .eq('uid', user.id)
      .order('date', { ascending: true });
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    const { data, error: movErr } = await query;
    if (movErr) {
      setError(movErr.message);
      return;
    }
    setMovements(data);
    // Compute summary
    let initial = 0;
    let debits = 0;
    let credits = 0;
    let final = 0;
    if (data.length > 0) {
      initial = data[0].balance_after - (data[0].credit || 0) + (data[0].debit || 0);
      data.forEach((m) => {
        debits += m.debit || 0;
        credits += m.credit || 0;
      });
      final = data[data.length - 1].balance_after;
    }
    setSummary({ initial, debits, credits, final });
  };

  // Format currency from cents to ARS string
  const formatMoney = (cents) => {
    return `ARS ${(cents / 100).toFixed(2)}`;
  };

  // USD estimation (fixed rate)
  const estimateUSD = (cents) => {
    const rate = 350;
    return `$${(cents / 100 / rate).toFixed(2)} USD`;
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['Fecha', 'Detalle', 'Débito', 'Crédito', 'Saldo'];
    const rows = movements.map((m) => [
      new Date(m.date).toISOString(),
      m.concept || m.detail || '',
      m.debit ? (m.debit / 100).toFixed(2) : '',
      m.credit ? (m.credit / 100).toFixed(2) : '',
      (m.balance_after / 100).toFixed(2)
    ]);
    const csvContent = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'extracto.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <h1>Extracto de cuenta</h1>
      {/* Filtros de fecha */}
      <div className="card">
        <h2>Filtros</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            Desde
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            Hasta
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          <button className="button" onClick={fetchExtract}>Consultar</button>
        </div>
      </div>
      {/* Resumen */}
      <div className="card">
        <h2>Resumen</h2>
        <p>Saldo inicial: {formatMoney(summary.initial)}</p>
        <p>Total débitos: {formatMoney(summary.debits)}</p>
        <p>Total créditos: {formatMoney(summary.credits)}</p>
        <p>Saldo final: {formatMoney(summary.final)}</p>
        <p>Estimado en USD: {estimateUSD(summary.final)}</p>
      </div>
      {/* Tabla de movimientos */}
      <div className="card">
        <h2>Movimientos</h2>
        {movements.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Detalle</th>
                <th style={{ textAlign: 'right' }}>Débito</th>
                <th style={{ textAlign: 'right' }}>Crédito</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.date).toLocaleDateString()}</td>
                  <td>{m.concept || m.detail || ''}</td>
                  <td style={{ textAlign: 'right' }}>{m.debit ? formatMoney(m.debit) : '-'}</td>
                  <td style={{ textAlign: 'right' }}>{m.credit ? formatMoney(m.credit) : '-'}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(m.balance_after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No hay movimientos en el periodo seleccionado.</p>
        )}
      </div>
      {/* Exportar e imprimir */}
      <div className="card" style={{ display: 'flex', gap: '1rem' }}>
        <button className="button" onClick={exportCSV}>Exportar CSV</button>
        <button className="button" onClick={() => window.print()}>Imprimir</button>
      </div>
      {error && <p className="msg-error">{error}</p>}
    </div>
  );
}