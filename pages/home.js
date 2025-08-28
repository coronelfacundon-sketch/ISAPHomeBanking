import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { toCents, currency } from '../utils/money';
import Link from 'next/link';

export default function HomePage() {
  const [me, setMe] = useState(null);
  const [account, setAccount] = useState(null);
  const [moves, setMoves] = useState([]);
  const [dest, setDest] = useState('');
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('Transferencia');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/'; return; }
      const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
      setMe(profile);

      const { data: acc } = await supabase.from('accounts').select('*').eq('uid', user.id).single();
      setAccount(acc || null);

      await loadMoves(user.id);
      setLoading(false);
    })();
  }, []);

  const loadMoves = async (uid) => {
    const { data } = await supabase.from('movements')
      .select('date,tx_id,concept,detail,debit,credit,balance_after,peer_company')
      .eq('uid', uid)
      .order('date', { ascending: false })
      .limit(10);
    setMoves(data || []);
  };

  const doTransfer = async (e) => {
    e.preventDefault();
    setError(''); setOk('');
    const cents = toCents(amount);
    if (cents <= 0) { setError('Importe inválido'); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc('transfer_funds', {
      p_origin_uid: me.id,
      p_dest: dest.trim(),
      p_amount: cents,
      p_concept: concept || 'Transferencia'
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setOk('Transferencia realizada');
    // redirigir a comprobante
    window.location.href = `/receipt?tx=${data}`;
  };

  if (loading) return <div className="p-6 text-white">Cargando…</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <h1 className="text-2xl font-bold">Bienvenido{me?.company_name ? `, ${me.company_name}` : ''}</h1>

      {/* Tarjeta de cuenta */}
      <div className="mt-4 rounded-xl bg-slate-800 p-4">
        <h2 className="text-lg font-semibold mb-2">Cuenta</h2>
        {account ? (
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div><div className="opacity-70">Alias</div><div className="font-mono">{account.alias}</div></div>
            <div><div className="opacity-70">CBU</div><div className="font-mono">{account.cbu}</div></div>
            <div><div className="opacity-70">Saldo</div><div className="font-bold">{currency(account.balance)}</div></div>
          </div>
        ) : (
          <div className="text-slate-300">Tu cuenta será creada cuando un empleado te apruebe.</div>
        )}
      </div>

      {/* Transferencia */}
      <div className="mt-4 rounded-xl bg-slate-800 p-4">
        <h2 className="text-lg font-semibold mb-2">Transferencia</h2>
        <form onSubmit={doTransfer} className="grid md:grid-cols-4 gap-3">
          <input className="rounded px-3 py-2 text-black" placeholder="Alias o CBU destino"
                 value={dest} onChange={(e)=>setDest(e.target.value)} />
          <input className="rounded px-3 py-2 text-black" placeholder="Importe (ej 5.000,00)"
                 value={amount} onChange={(e)=>setAmount(e.target.value)} />
          <input className="rounded px-3 py-2 text-black" placeholder="Concepto"
                 value={concept} onChange={(e)=>setConcept(e.target.value)} />
          <button className="rounded px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white">Transferir</button>
        </form>
        {error && <div className="mt-2 text-red-300 text-sm">{error}</div>}
        {ok && <div className="mt-2 text-emerald-300 text-sm">{ok}</div>}
      </div>

      {/* Movimientos recientes */}
      <div className="mt-4 rounded-xl bg-slate-800 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold mb-2">Movimientos recientes</h2>
          <Link href="/extract" className="text-sm underline">Ver extracto completo</Link>
        </div>
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
              {moves.map(m => (
                <tr key={m.tx_id + m.date} className="border-t border-slate-700">
                  <td className="p-2">{new Date(m.date).toLocaleString()}</td>
                  <td className="p-2">{m.concept} {m.peer_company ? `(${m.peer_company})` : ''}</td>
                  <td className="p-2 text-right">{m.debit ? currency(m.debit) : ''}</td>
                  <td className="p-2 text-right">{m.credit ? currency(m.credit) : ''}</td>
                  <td className="p-2 text-right">{currency(m.balance_after)}</td>
                  <td className="p-2"><a className="underline" href={`/receipt?tx=${m.tx_id}`}>Ver</a></td>
                </tr>
              ))}
              {moves.length === 0 && <tr><td className="p-2 text-slate-300" colSpan={6}>Sin movimientos</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
