# ISAP Homebanking - Admin Patch

Archivos incluidos:
- `pages/admin.js`: Panel de empleados con
  - Pendientes de aprobación (crea cuenta y aprueba vía RPC `approve_client`).
  - Listado de cuentas con buscador y botón **Acreditar** (RPC `bank_credit`).
- `components/CreditModal.js`: Modal sencillo para cargar importe.
- `utils/money.js`: helpers `toCents` y `currency`.
- `sql/approve_client.sql`: función SQL para aprobar clientes y crear su cuenta.

## Instrucciones

1. Copiá los archivos en tu proyecto respetando las rutas.
2. En Supabase, ejecutá `sql/approve_client.sql` en el SQL Editor.
3. Asegurate de tener ya creadas las funciones RPC `bank_credit` y policies RLS.
4. Deploy a Vercel.
