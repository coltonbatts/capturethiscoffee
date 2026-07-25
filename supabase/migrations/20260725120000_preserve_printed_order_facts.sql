-- A confirmed physical label is an irreversible fact. Older clients may send
-- a stale full order row containing label_printed = false; never let that
-- weaken a true value already observed by Postgres.
create or replace function public.preserve_order_label_printed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.label_printed = old.label_printed or new.label_printed;
  return new;
end;
$$;

drop trigger if exists orders_preserve_label_printed on public.orders;
create trigger orders_preserve_label_printed
before update of label_printed on public.orders
for each row
execute function public.preserve_order_label_printed();
