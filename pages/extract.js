import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { currency } from '../utils/money';
import { exportToCSV } from '../utils/csv';

export default function ExtractPage() {
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/'; return; }
      const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
      setMe(profile);
      await loadRows(user.id);
      setLoading(false);
    })();
  }, []);

  const loadRows = async (uid, s = null, e = null) => {
    let q = supabase.from('movements')
      .select('date,concept,detail,debit,credit,balance_after,tx_id,peer_company')
      .eq('uid', uid)
      .order('date', { ascending: true });
    if (s) q = q.gte('date', s);
    if (e) q = q.lte('date', e);
    const { data } = await q;
    setRows(data || []);
  };

  const summary = useMemo(() => {
    const initial = rows.length ? rows[0].balance_after - (rows[0].credit || 0) + (rows[0].debit || 0) : 0;
    const deb = rows.reduce((a,r)=>a+(r.debit||0),0);
    const cred = rows.reduce((a,r)=>a+(r.credit||0),0);
    const final = rows.length ? rows[rows.length-1].balance_after : initial + cred - deb;
    return { initial, deb, cred, final };
  }, [rows]);

  const apply = async () => {
    await loadRows(me.id, start || null, end || null);
  };

  const printIt = () => window.print();
  const exportCSV = () => {
    const data = rows.map(r => ({
      fecha: new Date(r.date).toLocaleString(),
      detalle: `${r.concept}${r.peer_company ? ' ('+r.peer_company+')' : ''}`,
      debito: (r.debit||0)/100,
      credito: (r.credit||0)/100,
      saldo: (r.balance_after||0)/100,
      comprobante: r.tx_id
    }));
    exportToCSV(data, 'extracto.csv');
  };

  if (loading) return <div className="p-6 text-white">Cargando…</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <link rel="stylesheet" href="/styles/print.css" />
      <h1 className="text-2xl font-bold">Extracto</h1>

      <div className="mt-3 grid md:grid-cols-5 gap-2 no-print">
        <div><div className="text-sm opacity-70 mb-1">Desde</div><input className="rounded px-3 py-2 text-black w-full" type="date" value={start} onChange={e=>setStart(e.target.value)} /></div>
        <div><div className="text-sm opacity-70 mb-1">Hasta</div><input className="rounded px-3 py-2 text-black w-full" type="date" value={end} onChange={e=>setEnd(e.target.value)} /></div>
        <div className="flex items-end gap-2">
          <button onClick={apply} className="rounded px-3 py-2 bg-slate-700 hover:bg-slate-600">Aplicar</button>
          <button onClick={exportCSV} className="rounded px-3 py-2 bg-slate-700 hover:bg-slate-600">Exportar CSV</button>
          <button onClick={printIt} className="rounded px-3 py-2 bg-slate-700 hover:bg-slate-600">Imprimir</button>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-800 p-4">
        <h2 className="text-lg font-semibold mb-2">Resumen</h2>
        <div className="grid md:grid-cols-4 gap-3 text-sm">
          <div><div className="opacity-70">Saldo inicial</div><div className="font-bold">{currency(summary.initial)}</div></div>
          <div><div className="opacity-70">Débitos</div><div className="font-bold">{currency(summary.deb)}</div></div>
          <div><div className="opacity-70">Créditos</div><div className="font-bold">{currency(summary.cred)}</div></div>
          <div><div className="opacity-70">Saldo final</div><div className="font-bold">{currency(summary.final)}</div></div>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-800 p-4">
        <h2 className="text-lg font-semibold mb-2">Movimientos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700">
              <tr>
                <th className="text-left p-2">Fecha</th>
                <th className="text-left p-2">Detalle</th>
                <th className="text-right p-2">Débito</th>
                <th className="text-right p-2">Crédito</th>
                <th className="text-right p-2">Saldo</th>
                <th className="text-left p-2">Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.tx_id + r.date} className="border-t border-slate-700">
                  <td className="p-2">{new Date(r.date).toLocaleString()}</td>
                  <td className="p-2">{r.concept}{r.peer_company ? ` (${r.peer_company})` : ''}</td>
                  <td className="p-2 text-right">{r.debit ? currency(r.debit) : ''}</td>
                  <td className="p-2 text-right">{r.credit ? currency(r.credit) : ''}</td>
                  <td className="p-2 text-right">{currency(r.balance_after)}</td>
                  <td className="p-2"><a className="underline" href={`/receipt?tx=${r.tx_id}`}>Ver</a></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="p-2 text-slate-300" colSpan={6}>Sin movimientos</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
