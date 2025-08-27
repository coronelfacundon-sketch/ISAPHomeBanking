# ISAP Bank Simulator

Este proyecto es una aplicación web de homebanking didáctico para colegios. Permite
a los alumnos simular operaciones bancarias como la creación de cuentas, transferencias,
acreditaciones de fondos, solicitudes de préstamos y consultas de movimientos.

## Requisitos previos

* Node.js 18 o superior y npm instalados en tu equipo.
* Una cuenta en [Supabase](https://supabase.com/) con un proyecto creado.
* Las variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  en un archivo `.env.local` (no incluído en el repositorio) con las credenciales de tu proyecto.

## Instalación

```bash
cd homebanking-simulation
npm install
```

Crear un archivo `.env.local` en la raíz del proyecto con el contenido:

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon
```

Arrancar el servidor de desarrollo:

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

## Configuración de la base de datos

El esquema de datos se define a continuación. Puedes ejecutar el siguiente SQL
en el editor de SQL de Supabase para crear las tablas necesarias. Las tablas
usan montos en centavos (enteros) para evitar problemas de punto flotante.

```sql
-- Tabla de usuarios (perfil extendido al margen de auth.users)
create table if not exists users (
  id uuid primary key references auth.users(id),
  email text not null,
  company_name text,
  type text, -- micro | pyme | gran | entity
  role text not null,
  status text not null default 'pending',
  created_at timestamp with time zone default now(),
  approved_at timestamp with time zone,
  approved_by uuid
);

-- Tabla de cuentas bancarias
create table if not exists accounts (
  uid uuid primary key,
  alias text unique,
  cbu text unique,
  balance bigint not null default 0,
  company_name text,
  type text,
  is_entity boolean default false
);

-- Tabla de movimientos (doble asiento contable)
create table if not exists movements (
  id uuid default gen_random_uuid() primary key,
  uid uuid not null references accounts(uid),
  date timestamp with time zone default now(),
  tx_id uuid not null,
  concept text,
  detail text,
  debit bigint,
  credit bigint,
  balance_after bigint not null,
  peer_uid uuid,
  peer_alias text,
  peer_cbu text,
  peer_company text,
  peer_email text,
  origin_uid uuid not null
);

-- Tabla de préstamos
create table if not exists loans (
  id uuid default gen_random_uuid() primary key,
  uid uuid not null references accounts(uid),
  amount bigint not null,
  status text not null default 'pending',
  created_at timestamp with time zone default now(),
  approved_at timestamp with time zone,
  approved_by uuid
);

-- Habilitar RLS
alter table users enable row level security;
alter table accounts enable row level security;
alter table movements enable row level security;
alter table loans enable row level security;

-- Políticas básicas de RLS
-- Los clientes sólo pueden ver y modificar su propia fila de users. Los empleados ven todo.
create policy if not exists "Clientes leen su fila" on users for select
  using (auth.uid() = id);
create policy if not exists "Clientes actualizan su fila" on users for update
  using (auth.uid() = id);
create policy if not exists "Empleados administran usuarios" on users
  for all to authenticated
  using (exists (select 1 from users u where u.id = auth.uid() and u.role = 'bank'));

-- Políticas de cuentas: clientes leen su cuenta; empleados gestionan todas.
create policy if not exists "Clientes leen su cuenta" on accounts for select
  using (auth.uid() = uid);
create policy if not exists "Empleados gestionan cuentas" on accounts
  for all to authenticated
  using (exists (select 1 from users u where u.id = auth.uid() and u.role = 'bank'));

-- Políticas de movimientos: clientes insertan vía RPC y leen sus movimientos; empleados ven todos.
create policy if not exists "Clientes leen sus movimientos" on movements for select
  using (auth.uid() = uid);
create policy if not exists "Empleados ven movimientos" on movements for select
  using (exists (select 1 from users u where u.id = auth.uid() and u.role = 'bank'));
-- Para evitar modificaciones directas, no se definen políticas de insert/update/delete; éstas deben
-- realizarse a través de funciones seguras.

-- Políticas de préstamos
create policy if not exists "Clientes gestionan sus préstamos" on loans for select, insert
  using (auth.uid() = uid);
create policy if not exists "Empleados aprueban préstamos" on loans for update
  using (exists (select 1 from users u where u.id = auth.uid() and u.role = 'bank'));

-- Función para transferir fondos (doble asiento y actualización de balances)
create or replace function public.transfer_funds(
  origin_uid uuid,
  dest_input text,
  amount_cents bigint,
  transfer_concept text
) returns void language plpgsql security definer as $$
declare
  dest_rec accounts%rowtype;
  origin_rec accounts%rowtype;
  tx uuid := gen_random_uuid();
begin
  -- Buscar cuenta destino por alias o cbu
  select * into dest_rec from accounts where alias = dest_input or cbu = dest_input;
  if dest_rec.uid is null then
    raise exception 'Cuenta destino no encontrada';
  end if;
  if dest_rec.uid = origin_uid then
    raise exception 'No puede transferir a la misma cuenta';
  end if;
  select * into origin_rec from accounts where uid = origin_uid;
  if origin_rec.balance < amount_cents then
    raise exception 'Saldo insuficiente';
  end if;
  -- Debitar origen
  update accounts set balance = balance - amount_cents where uid = origin_uid;
  insert into movements (uid, tx_id, concept, debit, credit, balance_after, peer_uid, peer_alias, peer_cbu, peer_company, peer_email, origin_uid)
    values (origin_uid, tx, transfer_concept, amount_cents, null,
      (origin_rec.balance - amount_cents), dest_rec.uid, dest_rec.alias, dest_rec.cbu, dest_rec.company_name, null, origin_uid);
  -- Acreditar destino
  update accounts set balance = balance + amount_cents where uid = dest_rec.uid;
  insert into movements (uid, tx_id, concept, debit, credit, balance_after, peer_uid, peer_alias, peer_cbu, peer_company, peer_email, origin_uid)
    values (dest_rec.uid, tx, transfer_concept, null, amount_cents,
      (dest_rec.balance + amount_cents), origin_rec.uid, origin_rec.alias, origin_rec.cbu, origin_rec.company_name, null, origin_uid);
end;
$$;

-- Función para acreditar fondos por el banco
create or replace function public.bank_credit(
  uid uuid,
  amount_cents bigint,
  credit_detail text
) returns void language plpgsql security definer as $$
declare
  acc accounts%rowtype;
  tx uuid := gen_random_uuid();
begin
  select * into acc from accounts where uid = bank_credit.uid;
  update accounts set balance = balance + amount_cents where uid = bank_credit.uid;
  insert into movements (uid, tx_id, concept, debit, credit, balance_after, peer_uid, peer_alias, peer_cbu, peer_company, peer_email, origin_uid)
    values (uid, tx, credit_detail, null, amount_cents, acc.balance + amount_cents, null, null, null, 'Banco', null, uid);
end;
$$;

-- Función para aprobar préstamos: acredita el importe y cambia estado
create or replace function public.approve_loan(
  loan_id uuid,
  approver_uid uuid
) returns void language plpgsql security definer as $$
declare
  loan_rec loans%rowtype;
begin
  select * into loan_rec from loans where id = approve_loan.loan_id;
  if loan_rec.status <> 'pending' then
    raise exception 'El préstamo ya fue procesado';
  end if;
  -- Acreditar a la cuenta
  perform public.bank_credit(loan_rec.uid, loan_rec.amount, 'Préstamo aprobado');
  -- Actualizar préstamo
  update loans set status = 'approved', approved_at = now(), approved_by = approver_uid where id = approve_loan.loan_id;
end;
$$;
```

Estas políticas y funciones utilizan Row-Level Security de PostgreSQL para
garantizar que los usuarios sólo vean o modifiquen la información que les
corresponde. Según el artículo “Setting Up Row‑Level Security in Supabase”,
activar RLS y definir políticas explícitas es imprescindible para controlar
el acceso a nivel de fila, impidiendo que usuarios no autorizados vean o
modifiquen datos de otros usuarios【621909778436727†L182-L208】.

## Flujos principales

1. **Registro de cliente**: los alumnos completan el formulario de registro con su empresa,
   tipo, email y contraseña. Se crea un usuario `auth` con rol `client` y
   `status=pending` en la tabla `users`. Un empleado debe aprobarlo.
2. **Aprobación de cliente**: los empleados ven la lista de clientes pendientes,
   generan un alias y CBU únicos y crean una fila en `accounts` con saldo 0.
   El estado del usuario se actualiza a `approved`.
3. **Transferencias**: los clientes aprobados pueden transferir a otros
   usuarios ingresando alias/CBU y monto. La función `transfer_funds`
   debita y acredita automáticamente, insertando dos movimientos con el
   mismo `tx_id` y actualizando los balances.
4. **Acreditaciones**: los empleados pueden acreditar fondos a cualquier
   cuenta mediante la función `bank_credit`, usada por el panel admin para
   cargar saldos iniciales.
5. **Préstamos**: los clientes pueden solicitar préstamos. Los empleados
   ven la lista de préstamos pendientes y, al aprobar, la función
   `approve_loan` acredita el importe y marca el préstamo como aprobado.
6. **Extracto y comprobantes**: los clientes consultan su extracto filtrando
   por fecha, exportan CSV o imprimen, y visualizan comprobantes de
   transferencias individuales.

## Tema y estilo

El diseño sigue una temática oscura con tonos de verde inglés para simular
un portal bancario real. Las páginas utilizan un menú superior con enlaces
contextuales según el rol (cliente o empleado) y tarjetas/resúmenes para
presentar la información de forma clara.
