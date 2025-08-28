// pages/admin-approve.js
// Panel mínimo para aprobar clientes SIN tocar archivos existentes.
// Requiere: supabase auth y tabla `users` con columnas: id (uuid), email, company_name, type, approved (boolean), role ('bank' para empleados).

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function AdminApprove() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/'; return; }

      // Validar empleado (role='bank')
      const { data: myRow, error: e1 } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', user.id)
        .single();

      if (e1 || !myRow) { alert('No se pudo obtener tu perfil'); return; }
      if (myRow.role !== 'bank') {
        alert('Acceso solo para empleados');
        window.location.href = '/';
        return;
      }
      setMe(myRow);
      await fetchPending();
    })();
  }, []);

  const fetchPending = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, email, company_name, type, approved, created_at')
      .eq('approved', false)
      .order('created_at', { ascending: true });

    if (error) alert(error.message);
    setPending(data || []);
    setLoading(false);
  };

  const approve = async (uid) => {
    const conf = confirm('¿Aprobar este cliente?');
    if (!conf) return;
    const { error } = await supabase.rpc('approve_client', { user_id: uid });
    if (error) { alert(error.message); return; }
    await fetchPending();
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return pending;
    return pending.filter(u =>
      (u.company_name || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s)
    );
  }, [pending, q]);

  if (!me) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-5xl mx-auto p-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Aprobación de clientes</h1>
          <button
            onClick={() => supabase.auth.signOut().then(()=>location.href='/')}
            className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600"
          >
            Salir
          </button>
        </header>

        <div className="mb-4 flex items-center gap-2">
          <input
            className="px-3 py-2 rounded text-black w-full max-w-md"
            placeholder="Buscar por empresa o email…"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
          />
          <button
            onClick={fetchPending}
            className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600"
          >
            Refrescar
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left p-3">Empresa</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Tipo</th>
                <th className="text-left p-3">Alta</th>
                <th className="text-left p-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.map(u => (
                <tr key={u.id} className="border-t border-slate-800">
                  <td className="p-3">{u.company_name || '-'}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.type || '-'}</td>
                  <td className="p-3">{new Date(u.created_at).toLocaleString()}</td>
                  <td className="p-3">
                    <button
                      onClick={() => approve(u.id)}
                      className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600"
                    >
                      Aprobar
                    </button>
                  </td>
                </tr>
              ))}
              {(!loading && filtered.length === 0) && (
                <tr><td className="p-3 text-slate-300" colSpan={5}>No hay clientes pendientes.</td></tr>
              )}
              {loading && (
                <tr><td className="p-3 text-slate-300" colSpan={5}>Cargando…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
