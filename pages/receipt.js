import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import ReceiptCard from '../components/ReceiptCard';
import { currency } from '../utils/money';

export default function ReceiptPage() {
  const router = useRouter();
  const { tx } = router.query;
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tx) return;
    (async () => {
      const { data, error } = await supabase.from('movements')
        .select('*')
        .eq('tx_id', tx)
        .order('date', { ascending: true });
      if (error) { setError(error.message); setLoading(false); return; }
      setEntries(data || []);
      setLoading(false);
    })();
  }, [tx]);

  const printIt = () => window.print();

  if (loading) return <div className="p-6 text-white">Cargando…</div>;
  if (error) return <div className="p-6 text-red-300">{error}</div>;
  if (entries.length === 0) return <div className="p-6 text-white">No se encontraron movimientos para este comprobante.</div>;

  const origin = entries.find(e => e.debit > 0) || entries[0];
  const dest   = entries.find(e => e.credit > 0) || entries[1];

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <link rel="stylesheet" href="/styles/print.css" />
      <h1 className="text-2xl font-bold mb-4">Comprobante</h1>

      <ReceiptCard
        origin={{
          company: origin.peer_company || 'Cuenta origen',
          alias: origin.peer_alias || '-',
          cbu: origin.peer_cbu || '-',
          balance_after: origin.balance_after
        }}
        dest={{
          company: dest?.peer_company || 'Cuenta destino',
          alias: dest?.peer_alias || '-',
          cbu: dest?.peer_cbu || '-',
          balance_after: dest?.balance_after || 0
        }}
        tx={tx}
        when={origin.date}
      />

      <div className="mt-4 no-print">
        <button onClick={printIt} className="rounded px-3 py-2 bg-slate-700 hover:bg-slate-600">Imprimir</button>
        <a href="/extract" className="ml-2 underline">Volver al extracto</a>
      </div>
    </div>
  );
}
