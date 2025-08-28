import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import CreditModal from '../components/CreditModal';
import { currency } from '../utils/money';

export default function Admin() {
  const [me, setMe] = useState(null);
  const [pending, setPending] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState({ open: false, account: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/'; return; }

      const { data: myRow } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!myRow || myRow.role !== 'bank') {
        alert('Acceso solo para empleados.');
        window.location.href = '/';
        return;
      }
      setMe(myRow);
      await refresh();
    })();
  }, []);

  const refresh = async () => {
    setLoading(true);

    const [{ data: pend, error: e1 }, { data: acc, error: e2 }] = await Promise.all([
      supabase.from('users').select('id,email,company_name,type,created_at')
        .eq('role','client').eq('status','pending').order('created_at',{ascending:true}),
      supabase.from('accounts')
        .select('uid,alias,cbu,balance,company_name,type,is_entity')
        .order('company_name',{ascending:true})
    ]);

    if (e1) console.error(e1);
    if (e2) console.error(e2);
    setPending(pend || []);
    setAccounts(acc || []);
    setLoading(false);
  };

  const approve = async (uid) => {
    setLoading(true);
    const { error } = await supabase.rpc('approve_client', {
      p_uid: uid,
      p_approver_uid: me.id
    });
    if (error) alert(error.message);
    await refresh();
  };

  const openCredit = (account) => setModal({ open: true, account });
  const doCredit = async (amountCents) => {
    const { account } = modal;
    setModal({ open: false, account: null });
    setLoading(true);
    const { error } = await supabase.rpc('bank_credit', {
      p_uid: account.uid,
      p_amount: amountCents,
      p_detail: 'Acreditación inicial'
    });
    if (error) alert(error.message);
    await refresh();
  };

  const filtered = accounts.filter(a => {
    const q = filter.toLowerCase().trim();
    if (!q) return true;
    return (
      (a.alias || '').toLowerCase().includes(q) ||
      (a.cbu || '').toLowerCase().includes(q) ||
      (a.company_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto p-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Panel de Empleados</h1>
          <button
            onClick={() => supabase.auth.signOut().then(()=>location.href='/')}
            className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600"
          >
            Salir
          </button>
        </header>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Pendientes de aprobación</h2>
          {pending.length === 0 ? (
            <div className="text-slate-300">No hay clientes pendientes.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="text-left p-3">Empresa</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-left p-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map(u => (
                    <tr key={u.id} className="border-t border-slate-800">
                      <td className="p-3">{u.company_name || '-'}</td>
                      <td className="p-3">{u.email}</td>
                      <td className="p-3">{u.type || '-'}</td>
                      <td className="p-3">
                        <button
                          onClick={() => approve(u.id)}
                          className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600"
                        >
                          Aprobar y crear cuenta
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Cuentas</h2>
            <input
              className="rounded px-3 py-2 text-black"
              placeholder="Buscar por alias / CBU / empresa"
              value={filter}
              onChange={(e)=>setFilter(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-800">
                <tr>
                  <th className="text-left p-3">Empresa</th>
                  <th className="text-left p-3">Alias</th>
                  <th className="text-left p-3">CBU</th>
                  <th className="text-right p-3">Saldo</th>
                  <th className="text-left p-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.uid} className="border-t border-slate-800">
                    <td className="p-3">{a.company_name || (a.is_entity ? 'Entidad pública' : '-')}</td>
                    <td className="p-3">{a.alias}</td>
                    <td className="p-3">{a.cbu}</td>
                    <td className="p-3 text-right">{currency(a.balance)}</td>
                    <td className="p-3">
                      {!a.is_entity && (
                        <button
                          onClick={() => openCredit(a)}
                          className="px-3 py-1.5 rounded bg-teal-700 hover:bg-teal-600"
                        >
                          Acreditar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td className="p-3 text-slate-300" colSpan={5}>No hay resultados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {loading && <div className="mt-4 text-sm text-slate-300">Actualizando…</div>}
      </div>

      <CreditModal
        open={modal.open}
        account={modal.account}
        onClose={() => setModal({ open:false, account:null })}
        onConfirm={doCredit}
      />
    </div>
  );
}
