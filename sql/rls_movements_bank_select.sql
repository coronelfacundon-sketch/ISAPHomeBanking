-- Permitir que empleados (role='bank') vean todos los movimientos
-- (Si la policy ya existe, este script fallará; ejecutar solo si falta)
create policy if not exists movements_bank_select_all
on public.movements
for select
to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'bank'));
