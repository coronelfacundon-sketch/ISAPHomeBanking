-- bank_credit: acredita saldo en cuenta de cliente
create or replace function public.bank_credit(
  p_uid uuid,
  p_amount bigint,
  p_detail text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acc accounts%rowtype;
  v_tx uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  if p_amount <= 0 then raise exception 'El monto debe ser mayor a 0'; end if;

  select * into v_acc from accounts where uid = p_uid for update;
  if not found then raise exception 'Cuenta no encontrada'; end if;

  update accounts set balance = balance + p_amount where uid = v_acc.uid;

  insert into movements(id, uid, date, tx_id, concept, detail, debit, credit, balance_after,
                        peer_uid, peer_alias, peer_cbu, peer_company, peer_email, origin_uid)
  values (gen_random_uuid(), v_acc.uid, v_now, v_tx, 'bank_credit', coalesce(p_detail,'acreditación'),
          0, p_amount, v_acc.balance + p_amount,
          null, null, null, 'ISAP Bank', null, auth.uid());

  return v_tx;
end;
$$;

grant execute on function public.bank_credit(uuid, bigint, text) to authenticated;
