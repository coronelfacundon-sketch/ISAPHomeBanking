import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { currency } from '../utils/money';
import { exportToCSV } from '../utils/csv';

export default function AdminMovements() {
  const [me, setMe] = useState(null);
  const [q, setQ] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/'; return; }
      const { data: myRow } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (!myRow || myRow.role !== 'bank') { alert('Acceso solo para empleados'); window.location.href = '/'; return; }
      setMe(myRow);
      await searchAccounts('');
    })();
  }, []);

  const searchAccounts = async (query) => {
    setLoading(true);
    const qstr = (query || '').trim();
    let accs = [];
    if (qstr) {
      const { data: a } = await supabase
        .from('accounts')
        .select('uid, alias, cbu, balance, company_name, is_entity')
        .or(`alias.ilike.%${qstr}%,cbu.ilike.%${qstr}%,company_name.ilike.%${qstr}%`)
        .limit(50);
      accs = a || [];

      // si busca por email
      const { data: u } = await supabase
        .from('users')
        .select('id, email, company_name')
        .ilike('email', `%${qstr}%`)
        .limit(10);
      if (u?.length) {
        const ids = u.map(x=>x.id);
        const { data: a2 } = await supabase.from('accounts').select('uid, alias, cbu, balance, company_name, is_entity').in('uid', ids);
        accs = [...accs, ...(a2||[])];
      }
      // dedup por uid
      const seen = new Set(); accs = accs.filter(x=> (seen.has(x.uid) ? false : seen.add(x.uid)));
    } else {
      const { data: a } = await supabase
        .from('accounts')
        .select('uid, alias, cbu, balance, company_name, is_entity')
        .order('company_name', { ascending: true })
        .limit(100);
      accs = a || [];
    }
    setAccounts(accs);
    setLoading(false);
  };

  const loadMovements = async (acc) => {
    setSelected(acc);
    setLoading(true);
    const { data } = await supabase.from('movements')
      .select('date,concept,detail,debit,credit,balance_after,tx_id,peer_company')
      .eq('uid', acc.uid)
      .order('date', { ascending: false })
      .limit(200);
    setRows(data || []);
    setLoading(false);
  };

  const exportCSV = () => {
    if (!rows.length) return;
    const data = rows.map(r => ({
      fecha: new Date(r.date).toLocaleString(),
      detalle: `${r.concept}${r.peer_company ? ' ('+r.peer_company+')' : ''}`,
      debito: (r.debit||0)/100,
      credito: (r.credit||0)/100,
      saldo: (r.balance_after||0)/100,
      comprobante: r.tx_id
    }));
    exportToCSV(data, `movimientos_${selected?.alias || 'cuenta'}.csv`);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-4">Movimientos (Banco)</h1>

      <div className="no-print mb-3 flex flex-wrap gap-2 items-center">
        <input className="px-3 py-2 rounded text-black w-full max-w-md"
               placeholder="Buscar cuentas por alias / CBU / empresa / email"
               value={q} onChange={e=>setQ(e.target.value)} />
        <button onClick={()=>searchAccounts(q)} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600">Buscar</button>
        <button onClick={()=>searchAccounts('')} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600">Limpiar</button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-slate-800 p-3">
          <h2 className="font-semibold mb-2">Cuentas</h2>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700">
                <tr>
                  <th className="text-left p-2">Empresa</th>
                  <th className="text-left p-2">Alias</th>
                  <th className="text-left p-2">CBU</th>
                  <th className="text-right p-2">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.uid} className="border-t border-slate-700 hover:bg-slate-700 cursor-pointer"
                      onClick={()=>loadMovements(a)}>
                    <td className="p-2">{a.company_name || (a.is_entity ? 'Entidad' : '-')}</td>
                    <td className="p-2">{a.alias}</td>
                    <td className="p-2">{a.cbu}</td>
                    <td className="p-2 text-right">{currency(a.balance)}</td>
                  </tr>
                ))}
                {accounts.length === 0 && <tr><td className="p-2 text-slate-300" colSpan={4}>Sin cuentas</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl bg-slate-800 p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Movimientos {selected ? `— ${selected.company_name} (${selected.alias})` : ''}</h2>
            <div className="no-print flex gap-2">
              <button onClick={exportCSV} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600" disabled={!rows.length}>Exportar CSV</button>
              <button onClick={()=>window.print()} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600" disabled={!rows.length}>Imprimir</button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[60vh] overflow-auto">
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
                    <td className="p-2"><a className="underline" href={`/receipt?tx=${r.tx_id}`} target="_blank" rel="noreferrer">Ver</a></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td className="p-2 text-slate-300" colSpan={6}>Seleccione una cuenta…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
