import { useEffect, useState } from 'react';
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
  const [accounts, setAccounts] = useState([]);
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

  // Search accounts by alias, cbu or email
  const searchAccounts = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const term = searchTerm.trim();
    if (!term) {
      setAccounts([]);
      return;
    }
    // Search by alias or cbu; also join users to get email
    const { data, error: accErr } = await supabase
      .from('accounts')
      .select('uid, alias, cbu, balance, company_name, type, users(email)')
      .or(`alias.ilike.%${term}%,cbu.ilike.%${term}%`);
    if (accErr) {
      setError(accErr.message);
    } else {
      setAccounts(data);
    }
  };

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
      {/* Pending clients */}
      <section style={{ marginTop: '1.5rem' }}>
        <h2>Clientes pendientes</h2>
        {pendingClients.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Empresa</th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Email</th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {pendingClients.map((c) => (
                <tr key={c.id}>
                  <td style={{ padding: '0.5rem' }}>{c.company_name}</td>
                  <td style={{ padding: '0.5rem' }}>{c.email}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <button
                      onClick={() => approveClient(c)}
                      style={{ padding: '0.4rem 0.8rem', backgroundColor: '#026c69', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Aprobar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No hay clientes pendientes.</p>
        )}
      </section>
      {/* Account search and credit */}
      <section style={{ marginTop: '2rem' }}>
        <h2>Buscar cuenta</h2>
        <form onSubmit={searchAccounts} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Alias o CBU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button
            type="submit"
            style={{ padding: '0.6rem 1rem', backgroundColor: '#026c69', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Buscar
          </button>
        </form>
        {accounts.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Empresa</th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Alias</th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>CBU</th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem', textAlign: 'right' }}>Saldo</th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Acreditar</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.uid}>
                  <td style={{ padding: '0.5rem' }}>{a.company_name}</td>
                  <td style={{ padding: '0.5rem' }}>{a.alias}</td>
                  <td style={{ padding: '0.5rem' }}>{a.cbu}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>ARS {(a.balance / 100).toFixed(2)}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={creditAmount[a.uid] || ''}
                      onChange={(e) => setCreditAmount((prev) => ({ ...prev, [a.uid]: e.target.value }))}
                      style={{ width: '80px', padding: '0.3rem', marginRight: '0.3rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <button
                      onClick={() => creditAccount(a)}
                      style={{ padding: '0.4rem 0.8rem', backgroundColor: '#026c69', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Acreditar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {/* Seed entities */}
      <section style={{ marginTop: '2rem' }}>
        <h2>Entidades públicas</h2>
        <button
          onClick={seedEntities}
          style={{ padding: '0.6rem 1rem', backgroundColor: '#026c69', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Sembrar/Actualizar
        </button>
      </section>
      {/* Loan requests */}
      <section style={{ marginTop: '2rem' }}>
        <h2>Solicitudes de préstamos</h2>
        {loanRequests.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Cliente</th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Monto</th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {loanRequests.map((l) => (
                <tr key={l.id}>
                  <td style={{ padding: '0.5rem' }}>{l.uid}</td>
                  <td style={{ padding: '0.5rem' }}>ARS {(l.amount / 100).toFixed(2)}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <button
                      onClick={() => approveLoan(l)}
                      style={{ padding: '0.4rem 0.8rem', backgroundColor: '#026c69', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Aprobar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No hay préstamos pendientes.</p>
        )}
      </section>
      {error && <p style={{ color: 'salmon', marginTop: '1rem' }}>{error}</p>}
      {message && <p style={{ color: 'lightyellow', marginTop: '1rem' }}>{message}</p>}
    </div>
  );
}