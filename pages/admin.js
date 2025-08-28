import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/router';

/**
 * Admin page for bank employees. Provides workflows to approve new clients,
 * credit accounts with funds, seed public entity accounts, and approve loans.
 */
export default function AdminPage({ user }) {
  const router = useRouter();
  const [pendingClients, setPendingClients] = useState([]);
  const [loanRequests, setLoanRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  // Holds all non‑entity accounts so they can be filtered client‑side
  const [accounts, setAccounts] = useState([]);
  // Holds the amount entered for each account when crediting
  const [creditAmount, setCreditAmount] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Redirect unauthorized users
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'bank') {
      router.replace('/');
    }
  }, [user, router]);

  // Load pending clients and loan requests on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!user || user.role !== 'bank') return;
      // Pending clients
      const { data: clients, error: clientsErr } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'client')
        .eq('status', 'pending');
      if (!clientsErr) setPendingClients(clients);
      // Pending loans
      const { data: loans, error: loansErr } = await supabase
        .from('loans')
        .select('id, uid, amount')
        .eq('status', 'pending');
      if (!loansErr) setLoanRequests(loans);
    };
    fetchData();
  }, [user]);

  // Approve client: create account with random alias/cbu and update status
  const approveClient = async (client) => {
    setError('');
    setMessage('');
    // Generate random alias (8 letters + 4 numbers)
    const alias = `${client.company_name.toLowerCase().replace(/\s+/g, '').slice(0,6)}${Math.floor(1000 + Math.random() * 9000)}`;
    const cbu = String(Math.floor(10 ** 21 + Math.random() * 9 * 10 ** 21));
    // Insert account
    const { error: accErr } = await supabase.from('accounts').insert({
      uid: client.id,
      alias,
      cbu,
      balance: 0,
      company_name: client.company_name,
      type: client.type,
      is_entity: false
    });
    if (accErr) {
      setError(accErr.message);
      return;
    }
    // Update user status
    const { error: userErr } = await supabase.from('users').update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user.id
    }).eq('id', client.id);
    if (userErr) {
      setError(userErr.message);
      return;
    }
    setMessage(`Cliente ${client.company_name} aprobado.`);
    // Refresh pending list
    setPendingClients((prev) => prev.filter((c) => c.id !== client.id));
  };

  // Fetch all client accounts on mount so the employee can see a full list
  useEffect(() => {
    const fetchAccounts = async () => {
      if (!user || user.role !== 'bank') return;
      const { data, error: accErr } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_entity', false);
      if (!accErr && data) {
        setAccounts(data);
      }
    };
    fetchAccounts();
  }, [user]);

  // Derived list of accounts filtered by search term.  When searchTerm is empty,
  // all accounts are shown.  The search is case insensitive over alias, CBU
  // and company name.
  const filteredAccounts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return accounts;
    return accounts.filter((acc) => {
      return (
        acc.alias.toLowerCase().includes(term) ||
        acc.cbu.toLowerCase().includes(term) ||
        acc.company_name.toLowerCase().includes(term)
      );
    });
  }, [accounts, searchTerm]);

  // Credit an account with specified amount
  const creditAccount = async (acc) => {
    setError('');
    setMessage('');
    const amount = parseFloat(creditAmount[acc.uid] || '0');
    if (!amount || amount <= 0) {
      setError('Ingrese un monto válido para acreditar.');
      return;
    }
    const cents = Math.round(amount * 100);
    // Use RPC or direct insert: update balance and insert movement
    // Insert credit movement: we assume a function bank_credit exists; fallback manual
    try {
      const { error: rpcErr } = await supabase.rpc('bank_credit', {
        uid: acc.uid,
        amount_cents: cents,
        credit_detail: 'Acreditación manual'
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      setMessage('Acreditación exitosa.');
      // Refresh account balance
      const { data: updated } = await supabase
        .from('accounts')
        .select('*')
        .eq('uid', acc.uid)
        .single();
      setAccounts((prev) => prev.map((a) => (a.uid === acc.uid ? { ...a, balance: updated.balance } : a)));
      // Reset input
      setCreditAmount((prev) => ({ ...prev, [acc.uid]: '' }));
    } catch (err) {
      setError(err.message);
    }
  };

  // Seed or update public entities (e.g. tax and service organizations)
  const seedEntities = async () => {
    setError('');
    setMessage('');
    const entities = [
      { company_name: 'ARBA', type: 'entity' },
      { company_name: 'ARCA', type: 'entity' },
      { company_name: 'Municipio', type: 'entity' },
      { company_name: 'ISAP Bank', type: 'entity' }
    ];
    for (const ent of entities) {
      // Check if user exists with this company name and is_entity
      const { data: existing } = await supabase
        .from('accounts')
        .select('uid')
        .eq('company_name', ent.company_name)
        .eq('is_entity', true)
        .maybeSingle();
      if (!existing) {
        const alias = `${ent.company_name.toLowerCase().replace(/\s+/g, '').slice(0,6)}${Math.floor(1000 + Math.random() * 9000)}`;
        const cbu = String(Math.floor(10 ** 21 + Math.random() * 9 * 10 ** 21));
        // Insert new user row with role='bank' and status='approved'
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: `${ent.company_name.toLowerCase()}@entities.local`,
          password: 'changeme123'
        });
        if (authErr) {
          console.error('Auth error seeding entity', authErr.message);
          continue;
        }
        const newUser = authData.user;
        // Insert into users table as bank entity
        await supabase.from('users').insert({
          id: newUser.id,
          email: newUser.email,
          company_name: ent.company_name,
          type: ent.type,
          role: 'bank',
          status: 'approved'
        });
        // Insert account
        await supabase.from('accounts').insert({
          uid: newUser.id,
          alias,
          cbu,
          balance: 0,
          company_name: ent.company_name,
          type: ent.type,
          is_entity: true
        });
      }
    }
    setMessage('Entidades sembradas/actualizadas.');
  };

  // Approve loan: credit account and mark loan approved
  const approveLoan = async (loan) => {
    setError('');
    setMessage('');
    try {
      // Call RPC to approve loan
      const { error: rpcErr } = await supabase.rpc('approve_loan', {
        loan_id: loan.id,
        approver_uid: user.id
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      setMessage('Préstamo aprobado y acreditado.');
      // Remove from pending list
      setLoanRequests((prev) => prev.filter((l) => l.id !== loan.id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1>Panel Administrativo</h1>
      {/* Clientes pendientes */}
      <div className="card">
        <h2>Clientes pendientes</h2>
        {pendingClients.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Email</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {pendingClients.map((c) => (
                <tr key={c.id}>
                  <td>{c.company_name}</td>
                  <td>{c.email}</td>
                  <td>
                    <button className="button" onClick={() => approveClient(c)}>Aprobar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No hay clientes pendientes.</p>
        )}
      </div>
      {/* Cuentas y acreditación */}
      <div className="card">
        <h2>Cuentas</h2>
        <div style={{ maxWidth: '400px', marginBottom: '1rem' }}>
          <input
            type="text"
            className="input"
            placeholder="Buscar por alias, CBU o empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {filteredAccounts.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Alias</th>
                <th>CBU</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
                <th>Acreditar</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((a) => (
                <tr key={a.uid}>
                  <td>{a.company_name}</td>
                  <td>{a.alias}</td>
                  <td>{a.cbu}</td>
                  <td style={{ textAlign: 'right' }}>ARS {(a.balance / 100).toFixed(2)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input"
                        style={{ width: '90px' }}
                        value={creditAmount[a.uid] || ''}
                        onChange={(e) => setCreditAmount((prev) => ({ ...prev, [a.uid]: e.target.value }))}
                      />
                      <button className="button" onClick={() => creditAccount(a)}>Acreditar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No hay cuentas disponibles.</p>
        )}
      </div>
      {/* Entidades públicas */}
      <div className="card">
        <h2>Entidades públicas</h2>
        <button className="button" onClick={seedEntities}>Sembrar/Actualizar</button>
      </div>
      {/* Solicitudes de préstamos */}
      <div className="card">
        <h2>Solicitudes de préstamos</h2>
        {loanRequests.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Monto</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {loanRequests.map((l) => (
                <tr key={l.id}>
                  <td>{l.uid}</td>
                  <td>ARS {(l.amount / 100).toFixed(2)}</td>
                  <td>
                    <button className="button" onClick={() => approveLoan(l)}>Aprobar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No hay préstamos pendientes.</p>
        )}
      </div>
      {error && <p className="msg-error">{error}</p>}
      {message && <p className="msg-success">{message}</p>}
    </div>
  );
}