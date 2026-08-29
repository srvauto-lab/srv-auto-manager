begin;

alter table public.factures
  add column if not exists issue_date date;

update public.factures
set issue_date = created_at::date
where issue_date is null;

alter table public.factures
  alter column issue_date set default current_date,
  alter column issue_date set not null;

create sequence if not exists public.facture_srvauto_seq
  start with 1 increment by 1 no minvalue no maxvalue cache 1;

create sequence if not exists public.facture_serhii_seq
  start with 1 increment by 1 no minvalue no maxvalue cache 1;

do $$
declare
  srvauto_max bigint;
  serhii_count bigint;
begin
  select greatest(
    coalesce(max(
      case
        when facture_number ~ '^FA-[0-9]{4}-[0-9]+$'
        then split_part(facture_number, '-', 3)::bigint
        else null
      end
    ), 0),
    count(*)
  )
  into srvauto_max
  from public.factures
  where seller = 'srvauto';

  if srvauto_max > 0 then
    perform setval('public.facture_srvauto_seq', srvauto_max, true);
  else
    perform setval('public.facture_srvauto_seq', 1, false);
  end if;

  select count(*)
  into serhii_count
  from public.factures
  where seller = 'serhii';

  if serhii_count > 0 then
    perform setval('public.facture_serhii_seq', serhii_count, true);
  else
    perform setval('public.facture_serhii_seq', 1, false);
  end if;
end;
$$;

create or replace function public.generate_facture_number()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  next_number bigint;
  number_prefix text;
begin
  new.issue_date := coalesce(new.issue_date, current_date);

  if new.facture_number is not null and btrim(new.facture_number) <> '' then
    new.facture_number := btrim(new.facture_number);
    return new;
  end if;

  if new.seller = 'serhii' then
    number_prefix := 'FS';
    next_number := nextval('public.facture_serhii_seq');
  else
    number_prefix := 'FA';
    next_number := nextval('public.facture_srvauto_seq');
  end if;

  new.facture_number :=
    number_prefix || '-' ||
    to_char(new.issue_date, 'YYMM') || '-' ||
    lpad(next_number::text, 6, '0');

  return new;
end;
$$;

drop trigger if exists set_facture_number on public.factures;

create trigger set_facture_number
before insert on public.factures
for each row
execute function public.generate_facture_number();

grant usage, select on sequence public.facture_srvauto_seq to authenticated;
grant usage, select on sequence public.facture_serhii_seq to authenticated;

commit;
