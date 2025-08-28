-- approve_client: marca approved y crea cuenta si no existe
create or replace function public.approve_client(
  p_uid uuid,
  p_approver_uid uuid default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users%rowtype;
  v_alias text;
  v_cbu text;
  v_now timestamptz := now();
begin
  select * into v_user from users where id = p_uid for update;
  if not found then raise exception 'Usuario no encontrado'; end if;

  update users set status='approved', approved_at=v_now, approved_by=p_approver_uid where id=p_uid;

  -- crear cuenta si no existe
  if not exists (select 1 from accounts where uid = p_uid) then
    v_alias := lower(replace(coalesce(v_user.company_name,'cliente'),' ','')) || '.' || substr(p_uid::text,1,6);
    v_alias := left(v_alias, 24);
    v_cbu := to_char(extract(epoch from v_now)::bigint, 'FM0000000000000000000000');

    insert into accounts(uid, alias, cbu, balance, company_name, type, is_entity)
    values (p_uid, v_alias, v_cbu, 0, v_user.company_name, v_user.type, false);
  end if;

  return json_build_object('status','approved');
end;
$$;

grant execute on function public.approve_client(uuid, uuid) to authenticated;
