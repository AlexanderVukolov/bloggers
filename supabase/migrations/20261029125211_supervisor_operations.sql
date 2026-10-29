-- Service-only API storage. Existing application data and IDs are preserved.
create schema if not exists nsl_bloggers_private;
revoke all on schema nsl_bloggers_private from public,anon,authenticated;
create table if not exists nsl_bloggers_private.backups (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  reason text not null, payload jsonb not null
);
revoke all on nsl_bloggers_private.backups from public,anon,authenticated;
grant usage on schema nsl_bloggers_private to service_role;
grant select,insert on nsl_bloggers_private.backups to service_role;

create table public.blogger_access (
  user_id uuid primary key references public.profiles(id),
  role text not null check (role in ('owner','supervisor')),
  permissions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table public.blogger_operations (
  id uuid primary key default gen_random_uuid(), actor uuid not null references auth.users(id),
  kind text not null, reason text not null, source text not null default 'crm',
  status text not null default 'preview' check(status in ('preview','committed','failed')),
  plan jsonb not null, result jsonb, created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 minutes', committed_at timestamptz
);
create index blogger_operations_actor_created on public.blogger_operations(actor,created_at desc);
create table public.blogger_external_ids (
  spreadsheet_id text not null, entity text not null check(entity in ('blogger','placement')),
  external_id text not null, crm_id text not null, baseline jsonb not null,
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
  primary key(spreadsheet_id,entity,external_id)
);
create table public.blogger_audit (
  id bigint generated always as identity primary key,
  operation_id uuid, table_name text not null, row_key jsonb not null,
  author uuid, changed_at timestamptz not null default clock_timestamp(),
  source text not null, reason text not null, old_value jsonb, new_value jsonb
);
create index blogger_audit_operation on public.blogger_audit(operation_id,id);
alter table public.blogger_evidence_reports add column if not exists blogger_id text;
alter table public.blogger_evidence_reports add column if not exists excluded_from_calculations boolean not null default false;
alter table public.blogger_evidence_reports add column if not exists exclusion_reason text not null default '';

alter table public.blogger_access enable row level security;
alter table public.blogger_operations enable row level security;
alter table public.blogger_external_ids enable row level security;
alter table public.blogger_audit enable row level security;
revoke all on public.blogger_access,public.blogger_operations,public.blogger_external_ids,public.blogger_audit from public,anon,authenticated;
grant select,insert,update on public.blogger_access,public.blogger_operations,public.blogger_external_ids to service_role;
grant select,insert on public.blogger_audit to service_role;
grant usage,select on sequence public.blogger_audit_id_seq to service_role;

create or replace function public.blogger_row_key(p_table text, p_row jsonb) returns jsonb
language plpgsql immutable security invoker set search_path=pg_catalog,public as $$
begin
  if p_table='blogger_shared_state' then return jsonb_build_object('namespace',p_row->'namespace','record_key',p_row->'record_key');
  elsif p_table='blogger_external_ids' then return jsonb_build_object('spreadsheet_id',p_row->'spreadsheet_id','entity',p_row->'entity','external_id',p_row->'external_id');
  elsif p_table in ('blogger_reach_actuals','blogger_placement_schedules') then return jsonb_build_object('placement_key',p_row->'placement_key');
  elsif p_table='blogger_evidence_placement_links' then return jsonb_build_object('report_id',p_row->'report_id','placement_key',p_row->'placement_key');
  elsif p_table in ('blogger_evidence_reports','blogger_contracts') then return jsonb_build_object('id',p_row->'id');
  elsif p_table='blogger_access' then return jsonb_build_object('user_id',p_row->'user_id');
  else raise exception 'UNSUPPORTED_TABLE';end if;
end $$;

create or replace function public.blogger_capture_audit() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_old jsonb;v_new jsonb;v_row jsonb;
begin
  if tg_op<>'INSERT' then v_old=to_jsonb(old);end if;
  if tg_op<>'DELETE' then v_new=to_jsonb(new);end if;
  v_row=coalesce(v_new,v_old);
  insert into public.blogger_audit(operation_id,table_name,row_key,author,source,reason,old_value,new_value)
  values(nullif(current_setting('nsl.operation_id',true),'')::uuid,tg_table_name,public.blogger_row_key(tg_table_name,v_row),
    coalesce(nullif(current_setting('nsl.actor',true),'')::uuid,(v_row->>'updated_by')::uuid,(v_row->>'created_by')::uuid,(v_row->>'uploaded_by')::uuid,(v_row->>'linked_by')::uuid),
    coalesce(nullif(current_setting('nsl.source',true),''),'legacy-api'),coalesce(nullif(current_setting('nsl.reason',true),''),'Изменение через действующий API'),v_old,v_new);
  if tg_op='DELETE' then return old;else return new;end if;
end $$;

do $$ declare t text;begin
  foreach t in array array['blogger_shared_state','blogger_reach_actuals','blogger_placement_schedules','blogger_evidence_reports','blogger_evidence_placement_links','blogger_contracts','blogger_external_ids','blogger_access'] loop
    execute format('create trigger blogger_audit_change after insert or update or delete on public.%I for each row execute function public.blogger_capture_audit()',t);
  end loop;
end $$;

create or replace function public.blogger_backup(p_reason text) returns uuid
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result uuid;v_payload jsonb='{}';t text;v_rows jsonb;
begin
  foreach t in array array['blogger_shared_state','blogger_reach_actuals','blogger_placement_schedules','blogger_evidence_reports','blogger_evidence_placement_links','blogger_contracts','blogger_employees','blogger_kpi_adjustments','blogger_kpi_month_bloggers','blogger_department_months','blogger_access','blogger_external_ids'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r',t) into v_rows;
    v_payload=v_payload||jsonb_build_object(t,v_rows);
  end loop;
  insert into nsl_bloggers_private.backups(reason,payload) values(p_reason,v_payload) returning id into result;
  return result;
end $$;

create or replace function public.blogger_commit_operation(p_actor uuid,p_operation uuid) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare op public.blogger_operations;acc public.blogger_access;emp public.blogger_employees;
  c jsonb;t text;k jsonb;b jsonb;a jsonb;actual jsonb;cols text;updates text;predicate text;keys text;
  applied jsonb='[]';v_result jsonb;backup_id uuid;v_names text[];
begin
  perform pg_advisory_xact_lock(hashtext('nsl-bloggers-mutations'));
  select * into op from public.blogger_operations where id=p_operation for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if not exists(select 1 from public.profiles where id=p_actor and is_active and (is_admin or dept='bloggers')) then raise exception 'FORBIDDEN';end if;
  select * into acc from public.blogger_access where user_id=p_actor;
  select * into emp from public.blogger_employees where profile_id=p_actor and status='active';
  if emp.id is null then raise exception 'FORBIDDEN';end if;
  if op.actor<>p_actor and coalesce(acc.role,'')<>'owner' then raise exception 'FORBIDDEN';end if;
  if op.status='committed' then return op.result;end if;
  if op.status<>'preview' or op.expires_at<now() then raise exception 'PREVIEW_EXPIRED';end if;
  if op.kind='legacy_write' then
    if coalesce(acc.role,'')<>'owner' and not(coalesce(acc.role,'')='supervisor' and acc.permissions->>'edit_work'='true') and emp.role not in ('manager','assistant') then raise exception 'FORBIDDEN';end if;
  elsif coalesce(acc.role,'')<>'owner' and not(coalesce(acc.role,'')='supervisor' and acc.permissions->>op.kind='true') then raise exception 'FORBIDDEN';end if;
  if coalesce(acc.role,'')='supervisor' and op.kind<>'legacy_write' and acc.permissions->>'read_all' is distinct from 'true' then raise exception 'FORBIDDEN';end if;
  if coalesce((op.plan->>'blocked')::boolean,false) then raise exception 'PREVIEW_BLOCKED';end if;
  if op.kind='import_apply' then backup_id=public.blogger_backup('Перед импортом '||op.id);end if;
  perform set_config('nsl.actor',p_actor::text,true);perform set_config('nsl.operation_id',op.id::text,true);
  perform set_config('nsl.reason',op.reason,true);perform set_config('nsl.source',op.source,true);
  v_names=array[emp.name,emp.assigned_manager]||emp.history_aliases;
  for c in select value from jsonb_array_elements(op.plan->'changes') loop
    t=c->>'table';k=c->'key';b=nullif(c->'before','null'::jsonb);a=nullif(c->'after','null'::jsonb);
    if t not in ('blogger_shared_state','blogger_reach_actuals','blogger_placement_schedules','blogger_evidence_reports','blogger_evidence_placement_links','blogger_contracts','blogger_external_ids') then raise exception 'UNSUPPORTED_TABLE';end if;
    if k<>public.blogger_row_key(t,coalesce(a,b)) then raise exception 'INVALID_KEY';end if;
    if coalesce(acc.role,'') not in ('owner','supervisor') then
      if t<>'blogger_shared_state' and t not in ('blogger_reach_actuals','blogger_placement_schedules','blogger_evidence_reports','blogger_evidence_placement_links','blogger_contracts') then raise exception 'FORBIDDEN';end if;
      if t='blogger_shared_state' then
        if k->>'namespace' not in ('blogger_create','blogger_contract','placement','manager_report','assistant_report','placement_format') then raise exception 'FORBIDDEN';end if;
        if not(coalesce((coalesce(a,b)->'value_json'->>'manager')=any(v_names),false) or coalesce((coalesce(a,b)->'value_json'->>'name')=any(v_names),false)) then raise exception 'FORBIDDEN';end if;
        if b is not null and not(coalesce((b->'value_json'->>'manager')=any(v_names),false) or coalesce((b->'value_json'->>'name')=any(v_names),false)) then raise exception 'FORBIDDEN';end if;
      end if;
    end if;
    select string_agg(format('to_jsonb(r)->%L = $1->%L',key,key),' and ') into predicate from jsonb_object_keys(k) key;
    execute format('select to_jsonb(r) from public.%I r where %s for update',t,predicate) into actual using k;
    if actual is distinct from b then raise exception 'CONFLICT:%:%',t,k;end if;
    if a is null then
      execute format('delete from public.%I r where %s',t,predicate) using k;
    else
      if t='blogger_shared_state' and length((a->'value_json')::text)>750000 then raise exception 'RECORD_TOO_LARGE';end if;
      if t in ('blogger_shared_state','blogger_reach_actuals','blogger_placement_schedules','blogger_external_ids') then a=a||jsonb_build_object('updated_at',clock_timestamp(),'updated_by',p_actor);end if;
      if t='blogger_evidence_placement_links' then a=a||jsonb_build_object('linked_at',clock_timestamp(),'linked_by',p_actor);end if;
      select string_agg(quote_ident(key),','),string_agg(format('%I=excluded.%I',key,key),',') into cols,updates from jsonb_object_keys(a) key;
      select string_agg(quote_ident(key),',') into keys from jsonb_object_keys(k) key;
      execute format('insert into public.%I as r (%s) select %s from jsonb_populate_record(null::public.%I,$1) on conflict (%s) do update set %s returning to_jsonb(r)',t,cols,cols,t,keys,updates) into actual using a;
    end if;
    applied=applied||jsonb_build_array(jsonb_build_object('table',t,'key',k,'before',b,'after',case when a is null then null else actual end));
  end loop;
  v_result=jsonb_build_object('operationId',op.id,'applied',jsonb_array_length(applied),'backupId',backup_id,'changes',applied);
  update public.blogger_operations set status='committed',committed_at=clock_timestamp(),result=v_result where id=op.id;
  return v_result;
end $$;

revoke all on function public.blogger_row_key(text,jsonb),public.blogger_capture_audit(),public.blogger_backup(text),public.blogger_commit_operation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.blogger_row_key(text,jsonb),public.blogger_capture_audit(),public.blogger_backup(text),public.blogger_commit_operation(uuid,uuid) to service_role;
-- Initial backup also records the pre-existing operational data before role assignment.
select public.blogger_backup('До подключения роли руководителя и управляемого импорта');

-- Existing profiles_update_own must not permit escalation through editable profile columns.
create or replace function nsl_bloggers_private.protect_profile_authority() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if current_user in ('anon','authenticated') and
    (new.is_admin is distinct from old.is_admin or new.role is distinct from old.role or new.dept is distinct from old.dept or new.is_active is distinct from old.is_active) then
    raise exception 'FORBIDDEN: security fields are server-managed';
  end if;
  return new;
end $$;
revoke all on function nsl_bloggers_private.protect_profile_authority() from public,anon,authenticated;
create trigger protect_profile_authority before update on public.profiles for each row execute function nsl_bloggers_private.protect_profile_authority();
revoke truncate on public.profiles,public.blogger_shared_state,public.blogger_employees,public.blogger_evidence_reports,public.blogger_evidence_placement_links,public.blogger_reach_actuals,public.blogger_placement_schedules,public.blogger_contracts from anon,authenticated;
