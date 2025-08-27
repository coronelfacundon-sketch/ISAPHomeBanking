import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/router';

/**
 * Receipt page shows a printable receipt for a given transaction. It
 * fetches both sides of the double-entry accounting and renders details
 * such as origin/destination, amounts and balances.
 */
export default function ReceiptPage({ user }) {
  const router = useRouter();
  const { tx } = router.query;
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEntries = async () => {
      if (!tx) return;
      const { data, error: movErr } = await supabase
        .from('movements')
        .select('*')
        .eq('tx_id', tx);
      if (movErr) {
        setError(movErr.message);
      } else {
        setEntries(data);
      }
    };
    fetchEntries();
  }, [tx]);

  // Helper to format money
  const formatMoney = (cents) => {
    return `ARS ${(cents / 100).toFixed(2)}`;
  };

  // Compose details from entries
  let debitEntry = null;
  let creditEntry = null;
  if (entries && entries.length === 2) {
    // Determine which is debit and credit
    entries.forEach((e) => {
      if (e.debit && e.debit > 0) debitEntry = e;
      if (e.credit && e.credit > 0) creditEntry = e;
    });
  }

  return (
    <div>
      <h1>Comprobante de transferencia</h1>
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      {entries.length === 0 && !error && <p>Cargando...</p>}
      {entries.length > 0 && (
        <div style={{ marginTop: '1rem', backgroundColor: '#013a63', padding: '1rem', borderRadius: '6px' }}>
          <p><strong>Fecha:</strong> {new Date(entries[0].date).toLocaleString()}</p>
          <hr style={{ borderColor: '#055a8c', margin: '1rem 0' }} />
          <div>
            <h2>Origen</h2>
            <p><strong>Empresa:</strong> {debitEntry?.company_name || '-'}</p>
            <p><strong>Alias:</strong> {debitEntry?.alias || debitEntry?.peer_alias || '-'}</p>
            <p><strong>CBU:</strong> {debitEntry?.cbu || debitEntry?.peer_cbu || '-'}</p>
            <p><strong>Monto debitado:</strong> {debitEntry ? formatMoney(debitEntry.debit) : '-'}</p>
            <p><strong>Saldo posterior:</strong> {debitEntry ? formatMoney(debitEntry.balance_after) : '-'}</p>
          </div>
          <hr style={{ borderColor: '#055a8c', margin: '1rem 0' }} />
          <div>
            <h2>Destino</h2>
            <p><strong>Empresa:</strong> {creditEntry?.peer_company || '-'}</p>
            <p><strong>Alias:</strong> {creditEntry?.peer_alias || '-'}</p>
            <p><strong>CBU:</strong> {creditEntry?.peer_cbu || '-'}</p>
            <p><strong>Monto acreditado:</strong> {creditEntry ? formatMoney(creditEntry.credit) : '-'}</p>
            <p><strong>Saldo posterior:</strong> {creditEntry ? formatMoney(creditEntry.balance_after) : '-'}</p>
          </div>
          <hr style={{ borderColor: '#055a8c', margin: '1rem 0' }} />
          <p><strong>Concepto:</strong> {debitEntry?.concept || debitEntry?.detail || ''}</p>
          <button
            onClick={() => window.print()}
            style={{ marginTop: '1rem', padding: '0.6rem 1rem', backgroundColor: '#026c69', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Imprimir
          </button>
        </div>
      )}
    </div>
  );
}