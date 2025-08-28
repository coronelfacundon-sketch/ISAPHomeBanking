-- transfer_funds: realiza doble asiento y devuelve tx_id
create or replace function public.transfer_funds(
  p_origin_uid uuid,
  p_dest text,
  p_amount bigint,
  p_concept text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origin accounts%rowtype;
  v_dest   accounts%rowtype;
  v_tx uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  if p_amount <= 0 then raise exception 'El monto debe ser mayor a 0'; end if;

  select * into v_origin from accounts where uid = p_origin_uid for update;
  if not found then raise exception 'Cuenta origen no encontrada'; end if;

  select * into v_dest from accounts where alias = p_dest or cbu = p_dest for update;
  if not found then raise exception 'Cuenta destino no encontrada'; end if;

  if v_origin.uid = v_dest.uid then raise exception 'No puedes transferirte a ti mismo'; end if;
  if v_origin.balance < p_amount then raise exception 'Saldo insuficiente'; end if;

  update accounts set balance = balance - p_amount where uid = v_origin.uid;
  insert into movements(id, uid, date, tx_id, concept, detail, debit, credit, balance_after,
                        peer_uid, peer_alias, peer_cbu, peer_company, peer_email, origin_uid)
  values (gen_random_uuid(), v_origin.uid, v_now, v_tx, coalesce(p_concept,'Transferencia'), 'transfer_out',
          p_amount, 0, v_origin.balance - p_amount,
          v_dest.uid, v_dest.alias, v_dest.cbu, v_dest.company_name, null, p_origin_uid);

  update accounts set balance = balance + p_amount where uid = v_dest.uid;
  insert into movements(id, uid, date, tx_id, concept, detail, debit, credit, balance_after,
                        peer_uid, peer_alias, peer_cbu, peer_company, peer_email, origin_uid)
  values (gen_random_uuid(), v_dest.uid, v_now, v_tx, coalesce(p_concept,'Transferencia'), 'transfer_in',
          0, p_amount, v_dest.balance + p_amount,
          v_origin.uid, v_origin.alias, v_origin.cbu, v_origin.company_name, null, p_origin_uid);

  return v_tx;
end;
$$;

grant execute on function public.transfer_funds(uuid, text, bigint, text) to authenticated;
