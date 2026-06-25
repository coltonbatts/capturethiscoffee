drop function if exists public.complete_label_print_job(uuid, uuid);

drop table if exists public.label_print_attempts cascade;
drop table if exists public.label_print_jobs cascade;
drop table if exists public.printer_devices cascade;
