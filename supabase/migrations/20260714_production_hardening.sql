-- SRV AUTO production hardening
-- Apply on the test Supabase project first.

begin;

-- -----------------------------------------------------------------------------
-- Permissions added for communications and audit log
-- -----------------------------------------------------------------------------
insert into public.app_permissions(permission_key, label, section, description, sort_order)
values
  ('communications.view', 'Просматривать историю сообщений', 'Коммуникации', null, 160),
  ('communications.send', 'Отправлять SMS и WhatsApp', 'Коммуникации', null, 161),
  ('audit.view', 'Просматривать журнал действий', 'Система', null, 170)
on conflict (permission_key) do update
set label = excluded.label,
    section = excluded.section,
    description = excluded.description,
    sort_order = excluded.sort_order;

insert into public.role_permissions(role, permission_key, allowed)
values
  ('chief_mechanic', 'communications.view', true),
  ('chief_mechanic', 'communications.send', true),
  ('reception', 'communications.view', true),
  ('reception', 'communications.send', true),
  ('accountant', 'communications.view', true),
  ('admin', 'communications.view', true),
  ('admin', 'communications.send', true),
  ('admin', 'audit.view', true)
on conflict (role, permission_key) do update set allowed = excluded.allowed;


create or replace function public.get_my_permissions()
returns table(permission_key text)
language sql
stable
security definer
set search_path = public
as $$
  select ap.permission_key
  from public.app_permissions ap
  where public.has_permission(ap.permission_key)
  order by ap.sort_order;
$$;

revoke execute on function public.get_my_permissions() from public, anon;
grant execute on function public.get_my_permissions() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Stable employee links while preserving text snapshots for historical display
-- -----------------------------------------------------------------------------
alter table public.appointments
  add column if not exists mechanic_id uuid references public.profiles(id) on delete set null;

alter table public.work_orders
  add column if not exists assigned_mechanic_id uuid references public.profiles(id) on delete set null;

update public.appointments a
set mechanic_id = p.id
from public.profiles p
where a.mechanic_id is null
  and a.mechanic is not null
  and lower(trim(a.mechanic)) = lower(trim(p.full_name));

create index if not exists appointments_mechanic_id_idx on public.appointments(mechanic_id);
create index if not exists work_orders_assigned_mechanic_id_idx on public.work_orders(assigned_mechanic_id);

-- -----------------------------------------------------------------------------
-- Client communications log
-- -----------------------------------------------------------------------------
create table if not exists public.client_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  channel text not null check (channel in ('sms', 'whatsapp')),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  recipient text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed', 'opened')),
  provider text,
  provider_message_id text,
  error_message text,
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  delivered_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists client_messages_client_created_idx
  on public.client_messages(client_id, created_at desc);
create index if not exists client_messages_work_order_idx
  on public.client_messages(work_order_id) where work_order_id is not null;
create unique index if not exists client_messages_provider_id_idx
  on public.client_messages(provider_message_id) where provider_message_id is not null;

-- -----------------------------------------------------------------------------
-- General audit log
-- -----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references public.profiles(id) on delete set null,
  user_name text,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
create index if not exists audit_log_table_record_idx on public.audit_log(table_name, record_id);
create index if not exists audit_log_user_idx on public.audit_log(user_id, created_at desc);

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_name text;
  v_record_id text;
  v_old jsonb;
  v_new jsonb;
begin
  select full_name into v_user_name
  from public.profiles
  where id = auth.uid();

  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_new := null;
    v_record_id := coalesce(v_old ->> 'id', '');
  elsif tg_op = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(new);
    v_record_id := coalesce(v_new ->> 'id', '');
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_record_id := coalesce(v_new ->> 'id', v_old ->> 'id', '');
  end if;

  insert into public.audit_log(
    user_id, user_name, action, table_name, record_id, old_data, new_data
  ) values (
    auth.uid(), v_user_name, lower(tg_op), tg_table_name, v_record_id, v_old, v_new
  );

  return coalesce(new, old);
end;
$$;

-- Audit the operational tables. Recreate triggers idempotently.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients','vehicles','appointments','work_orders','work_order_labor_items',
    'work_order_part_items','work_order_payments','inventory','inventory_movements',
    'devis','factures','company_settings','app_settings','vehicle_recommendations',
    'profiles','user_permission_overrides','client_messages'
  ] loop
    execute format('drop trigger if exists audit_%I on public.%I', t, t);
    execute format(
      'create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      t, t
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Atomic stock movement
-- -----------------------------------------------------------------------------
create or replace function public.apply_inventory_movement(
  p_inventory_item_id uuid,
  p_work_order_id uuid,
  p_work_order_part_item_id uuid,
  p_quantity_delta numeric,
  p_movement_type text,
  p_note text default null
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current numeric;
  v_next numeric;
begin
  if not public.has_permission('inventory.adjust') then
    raise exception 'Недостаточно прав для изменения склада';
  end if;

  if p_quantity_delta = 0 then
    raise exception 'Количество движения не может быть нулевым';
  end if;

  select quantity into v_current
  from public.inventory
  where id = p_inventory_item_id
  for update;

  if not found then
    raise exception 'Позиция склада не найдена';
  end if;

  v_next := coalesce(v_current, 0) + p_quantity_delta;
  if v_next < 0 then
    raise exception 'Недостаточно остатка на складе';
  end if;

  update public.inventory
  set quantity = v_next
  where id = p_inventory_item_id;

  insert into public.inventory_movements(
    inventory_item_id,
    work_order_id,
    work_order_part_item_id,
    movement_type,
    quantity,
    note
  ) values (
    p_inventory_item_id,
    p_work_order_id,
    p_work_order_part_item_id,
    p_movement_type,
    p_quantity_delta,
    p_note
  );

  return v_next;
end;
$$;

grant execute on function public.apply_inventory_movement(uuid, uuid, uuid, numeric, text, text)
to authenticated;

-- -----------------------------------------------------------------------------
-- Work-order financial consistency
-- -----------------------------------------------------------------------------
create or replace function public.recalculate_work_order_financials(p_work_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_labor numeric := 0;
  v_parts numeric := 0;
  v_parts_cost numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_profit numeric := 0;
begin
  select coalesce(sum(quantity * unit_price), 0)
    into v_labor
  from public.work_order_labor_items
  where work_order_id = p_work_order_id;

  select
    coalesce(sum(quantity * unit_price), 0),
    coalesce(sum(quantity * purchase_price), 0)
  into v_parts, v_parts_cost
  from public.work_order_part_items
  where work_order_id = p_work_order_id;

  select coalesce(discount_amount, 0)
  into v_discount
  from public.work_orders
  where id = p_work_order_id;

  v_total := greatest(0, v_labor + v_parts - v_discount);
  v_profit := v_labor + (v_parts - v_parts_cost) - v_discount;

  update public.work_orders
  set labor_total = v_labor,
      parts_total = v_parts,
      total_amount = v_total,
      parts_cost_total = v_parts_cost,
      gross_profit = v_profit,
      margin_percent = case when v_total > 0 then round((v_profit / v_total) * 100, 2) else 0 end
  where id = p_work_order_id;
end;
$$;

create or replace function public.trigger_recalculate_work_order_financials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_work_order_financials(coalesce(new.work_order_id, old.work_order_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists recalc_work_order_from_labor on public.work_order_labor_items;
create trigger recalc_work_order_from_labor
after insert or update or delete on public.work_order_labor_items
for each row execute function public.trigger_recalculate_work_order_financials();

drop trigger if exists recalc_work_order_from_parts on public.work_order_part_items;
create trigger recalc_work_order_from_parts
after insert or update or delete on public.work_order_part_items
for each row execute function public.trigger_recalculate_work_order_financials();

create or replace function public.recalculate_work_order_payment_summary(p_work_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paid numeric := 0;
  v_total numeric := 0;
  v_last_method text;
  v_last_date timestamptz;
begin
  select coalesce(sum(amount), 0)
    into v_paid
  from public.work_order_payments
  where work_order_id = p_work_order_id;

  select payment_method, payment_date
    into v_last_method, v_last_date
  from public.work_order_payments
  where work_order_id = p_work_order_id
  order by payment_date desc nulls last, id desc
  limit 1;

  select coalesce(total_amount, 0)
    into v_total
  from public.work_orders
  where id = p_work_order_id;

  update public.work_orders
  set paid_amount = v_paid,
      payment_status = case
        when v_paid <= 0 then 'Не оплачено'
        when v_total > 0 and v_paid >= v_total then 'Оплачено'
        else 'Частично оплачено'
      end,
      payment_method = v_last_method,
      payment_date = v_last_date
  where id = p_work_order_id;
end;
$$;

create or replace function public.sync_work_order_payment_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_work_order_payment_summary(coalesce(new.work_order_id, old.work_order_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_payment_summary on public.work_order_payments;
create trigger sync_payment_summary
after insert or update or delete on public.work_order_payments
for each row execute function public.sync_work_order_payment_summary();

-- Prevent invalid financial data.
alter table public.work_order_payments drop constraint if exists work_order_payments_amount_positive;
alter table public.work_order_payments add constraint work_order_payments_amount_positive check (amount > 0);

alter table public.work_order_labor_items drop constraint if exists work_order_labor_quantity_positive;
alter table public.work_order_labor_items add constraint work_order_labor_quantity_positive check (quantity > 0);

alter table public.work_order_part_items drop constraint if exists work_order_part_quantity_positive;
alter table public.work_order_part_items add constraint work_order_part_quantity_positive check (quantity > 0);

alter table public.inventory drop constraint if exists inventory_quantity_nonnegative;
alter table public.inventory add constraint inventory_quantity_nonnegative check (quantity >= 0);

alter table public.appointments drop constraint if exists appointments_valid_time;
alter table public.appointments add constraint appointments_valid_time check (end_time is null or end_time > start_time);

-- Useful indexes for all important relations.
create index if not exists vehicles_client_id_idx on public.vehicles(client_id);
create index if not exists appointments_client_date_idx on public.appointments(client_id, appointment_date);
create index if not exists appointments_vehicle_date_idx on public.appointments(vehicle_id, appointment_date);
create index if not exists appointments_work_order_idx on public.appointments(work_order_id) where work_order_id is not null;
create index if not exists work_orders_client_created_idx on public.work_orders(client_id, created_at desc);
create index if not exists work_orders_vehicle_created_idx on public.work_orders(vehicle_id, created_at desc);
create index if not exists labor_items_work_order_idx on public.work_order_labor_items(work_order_id);
create index if not exists part_items_work_order_idx on public.work_order_part_items(work_order_id);
create index if not exists payments_work_order_date_idx on public.work_order_payments(work_order_id, payment_date desc);
create index if not exists inventory_movements_item_created_idx on public.inventory_movements(inventory_item_id, created_at desc);
create index if not exists inventory_movements_order_idx on public.inventory_movements(work_order_id) where work_order_id is not null;
create index if not exists devis_work_order_idx on public.devis(work_order_id);
create index if not exists factures_work_order_idx on public.factures(work_order_id);

-- -----------------------------------------------------------------------------
-- Replace public/anon access with authenticated permission-based RLS.
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'app_settings','appointments','clients','company_settings','devis','documents',
        'employees','factures','inventory','inventory_movements','profiles',
        'service_catalog','suppliers','vehicle_mileage_history','vehicle_recommendations',
        'vehicles','work_order_checklists','work_order_history','work_order_labor_items',
        'work_order_part_items','work_order_payments','work_order_photos',
        'work_order_signatures','work_orders','client_messages','audit_log'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Remove direct anonymous grants from operational data.
do $$
declare
  t text;
begin
  foreach t in array array[
    'app_settings','appointments','clients','company_settings','devis','documents',
    'employees','factures','inventory','inventory_movements','profiles',
    'service_catalog','suppliers','vehicle_mileage_history','vehicle_recommendations',
    'vehicles','work_order_checklists','work_order_history','work_order_labor_items',
    'work_order_part_items','work_order_payments','work_order_photos',
    'work_order_signatures','work_orders','client_messages','audit_log'
  ] loop
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated;

-- Read-only common settings for any active authenticated employee.
create policy app_settings_read on public.app_settings for select to authenticated
using (public.current_user_role() is not null);
create policy app_settings_manage on public.app_settings for all to authenticated
using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

create policy company_settings_read on public.company_settings for select to authenticated
using (public.current_user_role() is not null);
create policy company_settings_manage on public.company_settings for all to authenticated
using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

-- Clients
create policy clients_read on public.clients for select to authenticated using (public.has_permission('clients.view'));
create policy clients_insert on public.clients for insert to authenticated with check (public.has_permission('clients.manage'));
create policy clients_update on public.clients for update to authenticated using (public.has_permission('clients.manage')) with check (public.has_permission('clients.manage'));
create policy clients_delete on public.clients for delete to authenticated using (public.has_permission('clients.delete'));

-- Vehicles and vehicle history/recommendations
create policy vehicles_read on public.vehicles for select to authenticated using (public.has_permission('vehicles.view'));
create policy vehicles_insert on public.vehicles for insert to authenticated with check (public.has_permission('vehicles.manage'));
create policy vehicles_update on public.vehicles for update to authenticated using (public.has_permission('vehicles.manage')) with check (public.has_permission('vehicles.manage'));
create policy vehicles_delete on public.vehicles for delete to authenticated using (public.has_permission('vehicles.delete'));

create policy mileage_read on public.vehicle_mileage_history for select to authenticated using (public.has_permission('vehicles.view'));
create policy mileage_manage on public.vehicle_mileage_history for all to authenticated using (public.has_permission('vehicles.manage')) with check (public.has_permission('vehicles.manage'));
create policy recommendations_read on public.vehicle_recommendations for select to authenticated using (public.has_permission('vehicles.view'));
create policy recommendations_manage on public.vehicle_recommendations for all to authenticated using (public.has_permission('vehicles.manage')) with check (public.has_permission('vehicles.manage'));

-- Calendar
create policy appointments_read on public.appointments for select to authenticated using (public.has_permission('calendar.view'));
create policy appointments_manage on public.appointments for all to authenticated using (public.has_permission('calendar.manage')) with check (public.has_permission('calendar.manage'));

-- Work orders and all operational children
create policy work_orders_read on public.work_orders for select to authenticated using (public.has_permission('work_orders.view'));
create policy work_orders_insert on public.work_orders for insert to authenticated with check (public.has_permission('work_orders.manage'));
create policy work_orders_update on public.work_orders for update to authenticated using (public.has_permission('work_orders.manage')) with check (public.has_permission('work_orders.manage'));
create policy work_orders_delete on public.work_orders for delete to authenticated using (public.has_permission('work_orders.delete'));

create policy labor_read on public.work_order_labor_items for select to authenticated using (public.has_permission('work_orders.view'));
create policy labor_manage on public.work_order_labor_items for all to authenticated using (public.has_permission('work_orders.manage')) with check (public.has_permission('work_orders.manage'));
create policy parts_read on public.work_order_part_items for select to authenticated using (public.has_permission('work_orders.view'));
create policy parts_manage on public.work_order_part_items for all to authenticated using (public.has_permission('work_orders.manage')) with check (public.has_permission('work_orders.manage'));
create policy checklist_read on public.work_order_checklists for select to authenticated using (public.has_permission('work_orders.view'));
create policy checklist_manage on public.work_order_checklists for all to authenticated using (public.has_permission('work_orders.manage')) with check (public.has_permission('work_orders.manage'));
create policy history_read on public.work_order_history for select to authenticated using (public.has_permission('work_orders.view'));
create policy history_manage on public.work_order_history for all to authenticated using (public.has_permission('work_orders.manage')) with check (public.has_permission('work_orders.manage'));
create policy photos_read on public.work_order_photos for select to authenticated using (public.has_permission('work_orders.view'));
create policy photos_manage on public.work_order_photos for all to authenticated using (public.has_permission('photos.manage')) with check (public.has_permission('photos.manage'));
create policy signatures_read on public.work_order_signatures for select to authenticated using (public.has_permission('work_orders.view'));
create policy signatures_manage on public.work_order_signatures for all to authenticated using (public.has_permission('signatures.manage')) with check (public.has_permission('signatures.manage'));

-- Payments
create policy payments_read on public.work_order_payments for select to authenticated using (public.has_permission('factures.view') or public.has_permission('work_orders.finances'));
create policy payments_manage on public.work_order_payments for all to authenticated using (public.has_permission('factures.payments')) with check (public.has_permission('factures.payments'));

-- Documents
create policy devis_read on public.devis for select to authenticated using (public.has_permission('devis.view'));
create policy devis_insert on public.devis for insert to authenticated with check (public.has_permission('devis.manage'));
create policy devis_update on public.devis for update to authenticated using (public.has_permission('devis.manage')) with check (public.has_permission('devis.manage'));
create policy devis_delete on public.devis for delete to authenticated using (public.has_permission('devis.delete'));

create policy factures_read on public.factures for select to authenticated using (public.has_permission('factures.view'));
create policy factures_insert on public.factures for insert to authenticated with check (public.has_permission('factures.manage'));
create policy factures_update on public.factures for update to authenticated using (public.has_permission('factures.manage')) with check (public.has_permission('factures.manage'));
create policy factures_delete on public.factures for delete to authenticated using (public.has_permission('factures.delete'));

create policy documents_read on public.documents for select to authenticated using (public.has_permission('devis.view') or public.has_permission('factures.view'));
create policy documents_manage on public.documents for all to authenticated using (public.has_permission('devis.manage') or public.has_permission('factures.manage')) with check (public.has_permission('devis.manage') or public.has_permission('factures.manage'));

-- Inventory
create policy inventory_read on public.inventory for select to authenticated using (public.has_permission('inventory.view'));
create policy inventory_insert on public.inventory for insert to authenticated with check (public.has_permission('inventory.manage'));
create policy inventory_update on public.inventory for update to authenticated using (public.has_permission('inventory.manage') or public.has_permission('inventory.adjust')) with check (public.has_permission('inventory.manage') or public.has_permission('inventory.adjust'));
create policy inventory_delete on public.inventory for delete to authenticated using (public.has_permission('inventory.delete'));
create policy movements_read on public.inventory_movements for select to authenticated using (public.has_permission('inventory.view'));
create policy movements_insert on public.inventory_movements for insert to authenticated with check (public.has_permission('inventory.adjust'));

-- Catalog and suppliers
create policy catalog_read on public.service_catalog for select to authenticated using (public.has_permission('service_catalog.view'));
create policy catalog_manage on public.service_catalog for all to authenticated using (public.has_permission('service_catalog.manage')) with check (public.has_permission('service_catalog.manage'));
create policy suppliers_read on public.suppliers for select to authenticated using (public.has_permission('suppliers.view'));
create policy suppliers_manage on public.suppliers for all to authenticated using (public.has_permission('suppliers.manage')) with check (public.has_permission('suppliers.manage'));

-- Profiles are the single employee identity source. Legacy employees stays read-only for migration compatibility.
create policy profiles_read_own_or_team on public.profiles for select to authenticated
using (id = auth.uid() or public.has_permission('employees.view') or public.has_permission('access.manage'));
create policy profiles_admin_manage on public.profiles for update to authenticated
using (public.has_permission('access.manage')) with check (public.has_permission('access.manage'));
create policy employees_legacy_read on public.employees for select to authenticated using (public.has_permission('employees.view'));

-- Communications and audit
create policy client_messages_read on public.client_messages for select to authenticated using (public.has_permission('communications.view'));
create policy client_messages_insert on public.client_messages for insert to authenticated with check (public.has_permission('communications.send'));
create policy client_messages_update on public.client_messages for update to authenticated using (public.has_permission('communications.send')) with check (public.has_permission('communications.send'));
create policy audit_log_read on public.audit_log for select to authenticated using (public.has_permission('audit.view'));

-- Ensure helper functions cannot be called by anonymous users.
revoke execute on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated, service_role;
revoke execute on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated, service_role;

-- Recalculate all current test work orders once.
do $$
declare r record;
begin
  for r in select id from public.work_orders loop
    perform public.recalculate_work_order_financials(r.id);
    perform public.recalculate_work_order_payment_summary(r.id);
  end loop;
end $$;

commit;
